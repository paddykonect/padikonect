import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { DiscoverQueryDto } from './dto/discover-query.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { RadarService } from './radar.service';

@ApiTags('radar')
@ApiBearerAuth()
@Controller('radar')
export class RadarController {
  constructor(private readonly radar: RadarService) {}

  @Get('me')
  status(@CurrentUser() user: AuthenticatedUser) {
    return this.radar.status(user.id);
  }

  // Clients refresh every couple of minutes while the app is open.
  @Put('me')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  share(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLocationDto,
  ) {
    return this.radar.share(user.id, dto.latitude, dto.longitude);
  }

  @Delete('me')
  @HttpCode(HttpStatus.OK)
  async stop(@CurrentUser() user: AuthenticatedUser) {
    await this.radar.stop(user.id);
    return { sharing: false, updatedAt: null };
  }

  @Get('padis')
  padis(@CurrentUser() user: AuthenticatedUser) {
    return this.radar.padisNearby(user.id);
  }

  // "People near you": discoverable sharers near the viewer's position.
  @Get('discover')
  discover(
    @CurrentUser() user: AuthenticatedUser,
    @Query() q: DiscoverQueryDto,
  ) {
    return this.radar.discover(user.id, q.lat, q.lng);
  }

  // Hide yourself from this padi on radar and in your profile (the eye toggle).
  @Post('hide/:userId')
  @HttpCode(HttpStatus.OK)
  async hide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') padiId: string,
  ) {
    await this.radar.hide(user.id, padiId);
    return { hidden: true };
  }

  @Delete('hide/:userId')
  @HttpCode(HttpStatus.OK)
  async unhide(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') padiId: string,
  ) {
    await this.radar.unhide(user.id, padiId);
    return { hidden: false };
  }
}
