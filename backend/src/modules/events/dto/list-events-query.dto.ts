import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { CursorPaginationQueryDto } from '../../../common/dto/cursor-pagination.dto';

// `Type(() => Boolean)` is deliberately NOT used here — it coerces via
// `Boolean(value)`, so the query string "false" (a non-empty string) would
// wrongly become `true`. This transform checks the literal string instead.
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' || value === true;

export class ListEventsQueryDto extends CursorPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Starting within the next ~12h' })
  @IsOptional()
  @Transform(toBoolean)
  tonight?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  nonAlcoholic?: boolean;

  @ApiPropertyOptional({ description: 'Free or ≤ ₦2,000' })
  @IsOptional()
  @Transform(toBoolean)
  underTwoK?: boolean;

  @ApiPropertyOptional({
    description: 'Requires lat/lng; filters to events within walking distance',
  })
  @IsOptional()
  @Transform(toBoolean)
  walkingDistance?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  lng?: number;
}
