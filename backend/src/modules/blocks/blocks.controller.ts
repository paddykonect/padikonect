import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { BlocksService } from './blocks.service';

@ApiTags('blocks')
@ApiBearerAuth()
@Controller('blocks')
export class BlocksController {
  constructor(private readonly blocks: BlocksService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) {
    return this.blocks.list(user.id);
  }

  @Put(':userId')
  @HttpCode(HttpStatus.OK)
  async block(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.blocks.block(user.id, userId);
    return { message: 'Blocked.' };
  }

  @Delete(':userId')
  @HttpCode(HttpStatus.OK)
  async unblock(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.blocks.unblock(user.id, userId);
    return { message: 'Unblocked.' };
  }
}
