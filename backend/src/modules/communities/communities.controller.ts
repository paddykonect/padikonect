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
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CloudinaryService } from '../../integrations/cloudinary/cloudinary.service';
import { CommunitiesService } from './communities.service';
import { CreateCommunityDto } from './dto/create-community.dto';
import { ReportCommunityDto } from './dto/report-community.dto';

@ApiTags('communities')
@ApiBearerAuth()
@Controller('communities')
export class CommunitiesController {
  constructor(
    private readonly communities: CommunitiesService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  @Get()
  @ApiQuery({ name: 'mine', required: false, type: Boolean })
  list(@CurrentUser() user: AuthenticatedUser, @Query('mine') mine?: string) {
    return this.communities.list(user.id, mine === 'true');
  }

  // Literal paths before ':id'.
  @Get('favorites')
  favorites(@CurrentUser() user: AuthenticatedUser) {
    return this.communities.listFavorites(user.id);
  }

  @Get('cover-upload-signature')
  coverUploadSignature(@CurrentUser() user: AuthenticatedUser) {
    return this.cloudinary.getSignedUploadParams(`communities/${user.id}`);
  }

  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCommunityDto,
  ) {
    return this.communities.create(user.id, dto);
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communities.getById(user.id, id);
  }

  @Get(':id/members')
  members(@Param('id', ParseUUIDPipe) id: string) {
    return this.communities.members(id);
  }

  @Get(':id/events')
  events(@Param('id', ParseUUIDPipe) id: string) {
    return this.communities.events(id);
  }

  @Post(':id/join')
  @HttpCode(HttpStatus.OK)
  join(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.communities.join(user.id, id);
  }

  @Put(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.communities.setFavorite(user.id, id, true);
    return { message: 'Added to favourites.' };
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.communities.setFavorite(user.id, id, false);
    return { message: 'Removed from favourites.' };
  }

  @Post(':id/report')
  @HttpCode(HttpStatus.OK)
  async report(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportCommunityDto,
  ) {
    await this.communities.report(user.id, id, dto.reason);
    return { message: 'Thanks — our team will take a look.' };
  }

  @Delete(':id/membership')
  @HttpCode(HttpStatus.OK)
  async leave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.communities.leave(user.id, id);
    return { message: 'You left the community.' };
  }
}
