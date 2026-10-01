import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CursorPaginationQueryDto } from '../../common/dto/cursor-pagination.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { FeedService } from './feed.service';

@ApiTags('feed')
@ApiBearerAuth()
@Controller('feed')
export class FeedController {
  constructor(private readonly feed: FeedService) {}

  @Get()
  list(@Query() query: CursorPaginationQueryDto) {
    return this.feed.list(query);
  }

  @Get('media-upload-signature')
  getMediaUploadSignature(@CurrentUser() user: AuthenticatedUser) {
    return this.feed.getMediaUploadSignature(user.id);
  }

  @Post('posts')
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreatePostDto) {
    return this.feed.create(user.id, dto);
  }

  @Delete('posts/:id')
  @HttpCode(HttpStatus.OK)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    await this.feed.remove(user.id, id);
    return { message: 'Post deleted.' };
  }
}
