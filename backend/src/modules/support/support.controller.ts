import { Body, Controller, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CreateSupportMessageDto } from './dto/create-support-message.dto';
import { SupportService } from './support.service';

@ApiTags('support')
@ApiBearerAuth()
@Controller('support')
export class SupportController {
  constructor(private readonly support: SupportService) {}

  @Post('messages')
  @Throttle({ default: { limit: 5, ttl: 60 * 60 * 1000 } })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSupportMessageDto,
  ) {
    return this.support.create(user.id, dto);
  }
}
