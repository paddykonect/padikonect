import {
  Body,
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
import { CheckInDto } from './dto/check-in.dto';
import { JoinEventDto } from './dto/join-event.dto';
import { RsvpDecisionDto } from './dto/rsvp-decision.dto';
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
    @Body() dto: JoinEventDto,
  ) {
    return this.rsvp.join(eventId, user.id, dto.message);
  }

  @Get('me/pass')
  myPass(
    @Param('eventId') eventId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rsvp.myPass(eventId, user.id);
  }

  @Post('check-in')
  @HttpCode(HttpStatus.OK)
  @UseGuards(EventHostGuard)
  checkIn(@Param('eventId') eventId: string, @Body() dto: CheckInDto) {
    return this.rsvp.checkIn(eventId, dto.code);
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

  @Get(':userId')
  @UseGuards(EventHostGuard)
  getOne(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.rsvp.getForHost(eventId, userId, user.id);
  }

  @Post(':userId/approve')
  @UseGuards(EventHostGuard)
  approve(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: RsvpDecisionDto,
  ) {
    return this.rsvp.approve(eventId, userId, dto.note);
  }

  @Post(':userId/decline')
  @UseGuards(EventHostGuard)
  decline(
    @Param('eventId') eventId: string,
    @Param('userId') userId: string,
    @Body() dto: RsvpDecisionDto,
  ) {
    return this.rsvp.decline(eventId, userId, dto.note);
  }
}
