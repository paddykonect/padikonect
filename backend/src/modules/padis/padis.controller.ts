import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CreateStatusDto } from './dto/create-status.dto';
import { RatePadiDto } from './dto/rate-padi.dto';
import { PadiRatingService } from './padi-rating.service';
import { PadisService } from './padis.service';
import { StatusesService } from './statuses.service';

@ApiTags('padis')
@ApiBearerAuth()
@Controller('padis')
export class PadisController {
  constructor(
    private readonly padis: PadisService,
    private readonly ratings: PadiRatingService,
  ) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.padis.list(user.id);
  }

  // "View the list" on the Padis map — all your padis (online/offline).
  @Get('directory')
  directory(@CurrentUser() user: AuthenticatedUser) {
    return this.padis.directory(user.id);
  }

  @Get(':userId/profile')
  profile(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.padis.profile(user.id, userId);
  }

  @Put(':userId')
  @HttpCode(HttpStatus.OK)
  async add(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) padiId: string,
  ) {
    await this.padis.add(user.id, padiId);
    return { message: 'Padi added.' };
  }

  // Rate a padi 1–5 stars for a hangout you both took part in. Returns the
  // refreshed rating context (new average/count + your stars).
  @Post(':userId/rating')
  @HttpCode(HttpStatus.OK)
  rate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) rateeId: string,
    @Body() dto: RatePadiDto,
  ) {
    return this.ratings.rate(user.id, rateeId, dto.eventId, dto.stars);
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) padiId: string,
  ) {
    await this.padis.remove(user.id, padiId);
    return { message: 'Padi removed.' };
  }
}

@ApiTags('statuses')
@ApiBearerAuth()
@Controller('statuses')
export class StatusesController {
  constructor(
    private readonly statuses: StatusesService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get('feed')
  feed(@CurrentUser() user: AuthenticatedUser) {
    return this.statuses.feed(user.id);
  }

  @Get('upload-signature')
  uploadSignature(@CurrentUser() user: AuthenticatedUser) {
    return this.cloudinary.getSignedUploadParams(`statuses/${user.id}`);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateStatusDto) {
    return this.statuses.create(user.id, dto);
  }

  @Post(':id/view')
  @HttpCode(HttpStatus.OK)
  async view(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.statuses.markViewed(user.id, id);
    return { message: 'Viewed.' };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.statuses.remove(user.id, id);
    return { message: 'Status deleted.' };
  }
}
