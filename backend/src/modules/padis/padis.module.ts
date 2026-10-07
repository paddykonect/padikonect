import { Module } from '@nestjs/common';
import { CloudinaryModule } from '../../integrations/cloudinary/cloudinary.module';
import { PadiRatingService } from './padi-rating.service';
import { PadisController, StatusesController } from './padis.controller';
import { PadisService } from './padis.service';
import { StatusesService } from './statuses.service';

@Module({
  imports: [CloudinaryModule],
  controllers: [PadisController, StatusesController],
  providers: [PadisService, StatusesService, PadiRatingService],
})
export class PadisModule {}
