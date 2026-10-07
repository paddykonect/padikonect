import { ApiPropertyOptional } from '@nestjs/swagger';
import { VenueCategory } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common/dto/cursor-pagination.dto';

export class ListVenuesQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ enum: VenueCategory })
  @IsOptional()
  @IsEnum(VenueCategory)
  category?: VenueCategory;

  @ApiPropertyOptional({
    description: 'Search place names and areas (case-insensitive)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
