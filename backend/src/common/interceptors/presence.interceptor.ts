import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';

// Per-user write throttle: we only persist lastSeenAt this often, so presence
// doesn't turn every request into a DB write while staying fresh enough for
// the ~5min online window (see presence.ts).
const WRITE_THROTTLE_MS = 60 * 1000;

// Bumps the authenticated user's lastSeenAt as a side effect of their requests.
@Injectable()
export class PresenceInterceptor implements NestInterceptor {
  // In-memory, per-instance throttle. For multi-instance deployments this
  // should move to Redis (see RedisModule) so the throttle is shared.
  private readonly lastWrite = new Map<string, number>();

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Guards run before interceptors, so request.user is already populated.
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: string } }>();
    const userId = request.user?.id;
    if (userId) this.touch(userId);
    return next.handle();
  }

  private touch(userId: string): void {
    const now = Date.now();
    if (now - (this.lastWrite.get(userId) ?? 0) < WRITE_THROTTLE_MS) return;
    this.lastWrite.set(userId, now);
    // Fire-and-forget: presence must never add latency to, or fail, a request.
    void this.prisma.user
      .updateMany({ where: { id: userId }, data: { lastSeenAt: new Date() } })
      .catch(() => undefined);
  }
}
