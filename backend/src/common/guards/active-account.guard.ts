import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { AppException } from '../exceptions/app.exception';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

@Injectable()
export class ActiveAccountGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<{ user: AuthenticatedUser }>();
    if (request.user.status !== 'ACTIVE') {
      throw new AppException(
        'ACCOUNT_NOT_ACTIVE',
        'Your account is not active.',
        HttpStatus.FORBIDDEN,
        { status: request.user.status },
      );
    }
    return true;
  }
}
