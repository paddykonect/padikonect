import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../integrations/cloudinary/cloudinary.module';
import { CommunitiesController } from './communities.controller';
import { CommunitiesService } from './communities.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [CommunitiesController],
  providers: [CommunitiesService],
})
export class CommunitiesModule {}
