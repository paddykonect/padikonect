import { ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import Redis from 'ioredis';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { REDIS_CLIENT } from '../../database/redis.module';
import { AppException } from '../exceptions/app.exception';
import { HttpStatus } from '@nestjs/common';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly reflector: Reflector,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const passportResult = await super.canActivate(context);
    if (!passportResult) return false;

    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    // Bounds revocation latency to well under the access-token TTL — admin
    // suspend/password-reset take effect immediately instead of waiting out
    // an otherwise-still-valid JWT.
    const revoked = await this.redis.get(`revoked:${request.user.id}`);
    if (revoked) {
      throw new AppException(
        'SESSION_REVOKED',
        'Your session has been revoked. Please log in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return true;
  }
}
