import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { VerifiedGuard } from '../../common/guards/verified.guard';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventsService } from './events.service';
import { EventHostGuard } from './guards/event-host.guard';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  list(@Query() query: ListEventsQueryDto) {
    return this.events.list(query);
  }

  @Get('cover-upload-signature')
  getCoverUploadSignature(@CurrentUser() user: AuthenticatedUser) {
    return this.cloudinary.getSignedUploadParams(`events/${user.id}`);
  }

  // Server-enforced: a user cannot become a host by editing client state.
  // PremiumGuard/VerifiedGuard are always-allow stubs until the
  // Premium+Verification phase — see plan §Auth & session strategy.
  @Post()
  @UseGuards(PremiumGuard, VerifiedGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.id, dto);
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.events.getById(id);
  }

  @Get(':id/attendees')
  getAttendees(@Param('id') id: string) {
    return this.events.getAttendees(id);
  }

  @Patch(':id')
  @UseGuards(EventHostGuard)
  update(@Param('id') id: string, @Body() dto: UpdateEventDto) {
    return this.events.update(id, dto);
  }

  @Post(':id/cancel')
  @UseGuards(EventHostGuard)
  cancel(@Param('id') id: string, @Body() dto: CancelEventDto) {
    return this.events.cancel(id, dto);
  }
}
