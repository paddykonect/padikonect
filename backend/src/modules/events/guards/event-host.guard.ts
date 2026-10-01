import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { AppException } from '../../../common/exceptions/app.exception';
import type { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';
import { PrismaService } from '../../../database/prisma.service';

/**
 * Authorizes event-management actions (edit/cancel/manage-requests) to the
 * event's host only — deliberately NOT combined with Premium/Verified, since
 * a lapsed-but-live host must still be able to manage an already-published
 * event (see plan §Module map).
 */
@Injectable()
export class EventHostGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user: AuthenticatedUser }>();
    const eventId = (request.params.eventId ?? request.params.id) as string;

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { hostId: true },
    });
    if (!event) {
      throw new AppException(
        'EVENT_NOT_FOUND',
        'Hangout not found.',
        HttpStatus.NOT_FOUND,
      );
    }
    if (event.hostId !== request.user.id) {
      throw new AppException(
        'NOT_EVENT_HOST',
        'Only the host can do this.',
        HttpStatus.FORBIDDEN,
      );
    }
    return true;
  }
}
