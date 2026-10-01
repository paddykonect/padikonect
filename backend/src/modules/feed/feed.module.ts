import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../integrations/cloudinary/cloudinary.module';
import { FeedController } from './feed.controller';
import { FeedService } from './feed.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [FeedController],
  providers: [FeedService],
})
export class FeedModule {}
