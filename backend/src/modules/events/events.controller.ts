import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PremiumGuard } from '../../common/guards/premium.guard';
import { VerifiedGuard } from '../../common/guards/verified.guard';
import { AppException } from '../../common/exceptions/app.exception';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CancelEventDto } from './dto/cancel-event.dto';
import { CreateEventDto } from './dto/create-event.dto';
import { ListEventsQueryDto } from './dto/list-events-query.dto';
import { InvitePadisDto } from './dto/invite-padis.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { VenueResponseDto } from './dto/venue-response.dto';
import { EventsService } from './events.service';
import { EventHostGuard } from './guards/event-host.guard';
import { HostingService } from './hosting.service';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(
    private readonly events: EventsService,
    private readonly hosting: HostingService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListEventsQueryDto,
  ) {
    return this.events.list(query, user.id);
  }

  @Get('mine')
  mine(@CurrentUser() user: AuthenticatedUser) {
    return this.events.listMine(user.id);
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthenticatedUser) {
    return this.events.listFavorites(user.id);
  }

  @Get('cover-upload-signature')
  getCoverUploadSignature(@CurrentUser() user: AuthenticatedUser) {
    return this.cloudinary.getSignedUploadParams(`events/${user.id}`);
  }

  // Save/unsave a hangout (the heart on a hangout card).
  @Put(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.events.addFavorite(user.id, id);
    return { message: 'Added to favourites.' };
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.events.removeFavorite(user.id, id);
    return { message: 'Removed from favourites.' };
  }

  // Server-enforced: a user cannot become a host by editing client state.
  // PremiumGuard/VerifiedGuard are always-allow stubs until the
  // Premium+Verification phase — see plan §Auth & session strategy.
  @Post()
  @UseGuards(PremiumGuard, VerifiedGuard)
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateEventDto) {
    return this.events.create(user.id, dto);
  }

  // Declared before ':id' so the literal path wins.
  @Get('venue-requests')
  listVenueRequests(@CurrentUser() user: AuthenticatedUser) {
    this.assertAdmin(user);
    return this.hosting.listVenueRequests();
  }

  @Get(':id')
  getById(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.events.getById(id, user.id, user.role === 'ADMIN');
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

  @Post(':id/venue-request')
  @UseGuards(EventHostGuard)
  requestVenue(@Param('id') id: string) {
    return this.hosting.requestVenueConfirmation(id);
  }

  // Venues don't have accounts yet, so an admin answers for them.
  @Post(':id/venue-response')
  respondForVenue(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VenueResponseDto,
  ) {
    this.assertAdmin(user);
    return this.hosting.respondForVenue(id, dto);
  }

  @Get(':id/invite-candidates')
  @UseGuards(EventHostGuard)
  inviteCandidates(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.hosting.inviteCandidates(id, user.id);
  }

  @Post(':id/invites')
  @UseGuards(EventHostGuard)
  invite(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: InvitePadisDto,
  ) {
    return this.hosting.invite(id, user.id, dto.userIds);
  }

  private assertAdmin(user: AuthenticatedUser): void {
    if (user.role !== 'ADMIN') {
      throw new AppException(
        'FORBIDDEN',
        'Only admins can respond for a venue.',
        HttpStatus.FORBIDDEN,
      );
    }
  }
}
