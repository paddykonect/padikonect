import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { RsvpService } from './rsvp.service';

@ApiTags('rsvp')
@ApiBearerAuth()
@Controller('rsvps')
export class RsvpMeController {
  constructor(private readonly rsvp: RsvpService) {}

  @Get('me')
  myRsvps(@CurrentUser() user: AuthenticatedUser) {
    return this.rsvp.myRsvps(user.id);
  }
}
