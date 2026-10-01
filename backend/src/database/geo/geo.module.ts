import { Module } from '@nestjs/common';
import { GeoRepository } from './geo.repository';

@Module({
  providers: [GeoRepository],
  exports: [GeoRepository],
})
export class GeoModule {}
