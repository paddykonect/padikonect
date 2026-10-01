import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { EventHostGuard } from '../events/guards/event-host.guard';
import { RsvpService } from './rsvp.service';

// Event-scoped RSVP actions. Deliberately a separate path shape from
// `GET /rsvps/me` (a different controller, see rsvp-me.controller.ts) so the
// literal "me" segment can never collide with the `:eventId` route param.
@ApiTags('rsvp')
@ApiBearerAuth()
@Controller('events/:eventId/rsvps')
export class RsvpController {
  constructor(private readonly rsvp: RsvpService) {}

  @Post()
  join(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rsvp.join(eventId, user.id);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    await this.rsvp.cancel(eventId, user.id);
    return { message: 'RSVP cancelled.' };
  }

  @Get()
  @UseGuards(EventHostGuard)
  listPending(@Param('eventId') eventId: string) {
    return this.rsvp.listPendingForHost(eventId);
  }

  @Post(':userId/approve')
  @UseGuards(EventHostGuard)
  approve(@Param('eventId') eventId: string, @Param('userId') userId: string) {
    return this.rsvp.approve(eventId, userId);
  }

  @Post(':userId/decline')
  @UseGuards(EventHostGuard)
  decline(@Param('eventId') eventId: string, @Param('userId') userId: string) {
    return this.rsvp.decline(eventId, userId);
  }
}
