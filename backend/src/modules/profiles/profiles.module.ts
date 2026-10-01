import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../integrations/cloudinary/cloudinary.module';
import { ProfilesController } from './profiles.controller';
import { ProfilesService } from './profiles.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [ProfilesController],
  providers: [ProfilesService],
  exports: [ProfilesService],
})
export class ProfilesModule {}
