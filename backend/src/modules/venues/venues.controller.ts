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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ListVenuesQueryDto } from './dto/list-venues-query.dto';
import { ReviewVenueDto } from './dto/review-venue.dto';
import { VenuesService } from './venues.service';

@ApiTags('venues')
@ApiBearerAuth()
@Controller('venues')
export class VenuesController {
  constructor(private readonly venues: VenuesService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListVenuesQueryDto,
  ) {
    return this.venues.list(user.id, query);
  }

  @Get('favorites')
  favorites(@CurrentUser() user: AuthenticatedUser) {
    return this.venues.listFavorites(user.id);
  }

  @Put(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async addFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.venues.addFavorite(user.id, id);
    return { message: 'Added to favourites.' };
  }

  @Delete(':id/favorite')
  @HttpCode(HttpStatus.OK)
  async removeFavorite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.venues.removeFavorite(user.id, id);
    return { message: 'Removed from favourites.' };
  }

  @Get(':id')
  getById(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.venues.getById(user.id, id);
  }

  @Post(':id/reviews')
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVenueDto,
  ) {
    return this.venues.review(user.id, id, dto);
  }
}
