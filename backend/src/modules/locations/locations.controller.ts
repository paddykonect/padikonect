import { Controller, Get, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { LocationsService } from './locations.service';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  // Empty array when the dataset has no subdivisions for that country —
  // the client skips the State step in that case.
  @Get('countries/:code/states')
  states(@Param('code') code: string) {
    return this.locations.getStates(code);
  }
}
