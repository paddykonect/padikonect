import { Inject, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import Redis from 'ioredis';
import { Server, Socket } from 'socket.io';
import { REDIS_CLIENT } from '../../database/redis.module';

interface AccessTokenPayload {
  sub: string;
}

/**
 * Pushes chat events to clients. Each authenticated socket joins its own
 * `user:<id>` room; the REST send endpoint (the only write path) fans new
 * messages out to every participant's room.
 */
@WebSocketGateway({
  namespace: '/chat',
  // Checked per connection: decorators run at import time, before
  // ConfigModule has loaded .env. Auth is a token in the handshake (no
  // cookies), so credentials aren't needed.
  cors: {
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => cb(null, !origin || origin === process.env.CORS_ORIGIN),
  },
})
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwt: JwtService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    const token = (client.handshake.auth as { token?: unknown })?.token;
    try {
      if (typeof token !== 'string') throw new Error('missing token');
      const payload = await this.jwt.verifyAsync<AccessTokenPayload>(token);
      if (await this.redis.get(`revoked:${payload.sub}`)) {
        throw new Error('revoked');
      }
      await client.join(`user:${payload.sub}`);
    } catch {
      client.emit('auth_error', { message: 'Unauthorized' });
      client.disconnect(true);
    }
  }

  emitToUsers(userIds: string[], event: string, payload: unknown): void {
    if (!this.server) return;
    this.server.to(userIds.map((id) => `user:${id}`)).emit(event, payload);
  }
}
