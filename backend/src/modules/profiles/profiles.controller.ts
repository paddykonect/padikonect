import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfilesService } from './profiles.service';

@ApiTags('profiles')
@ApiBearerAuth()
@Controller('profiles')
export class ProfilesController {
  constructor(private readonly profiles: ProfilesService) {}

  @Get('me')
  getOwn(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getOwn(user.id);
  }

  @Patch('me')
  updateOwn(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.profiles.updateOwn(user.id, dto);
  }

  @Get('me/avatar-upload-signature')
  getAvatarUploadSignature(@CurrentUser() user: AuthenticatedUser) {
    return this.profiles.getAvatarUploadSignature(user.id);
  }

  @Patch('me/avatar')
  updateAvatar(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateAvatarDto,
  ) {
    return this.profiles.updateAvatar(user.id, dto.photoUrl);
  }

  @Get(':userId')
  getPublic(
    @Param('userId') userId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.profiles.getPublic(userId, user.id);
  }
}
