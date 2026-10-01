import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { EventDrinkCategory, EventPrivacy } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  title!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({
    description:
      'Free-text address, always stored for display regardless of lat/lng',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  addressText!: string;

  @ApiPropertyOptional({
    description:
      'Map-picker mode. If omitted, the server geocodes addressText instead.',
  })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiProperty()
  @IsDateString()
  startAt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  endAt?: string;

  @ApiProperty()
  @IsInt()
  @IsPositive()
  @Max(1000)
  capacity!: number;

  @ApiPropertyOptional({ description: 'Price in kobo (₦1 = 100 kobo)' })
  @IsOptional()
  @IsInt()
  @Min(0)
  priceKobo?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  coverImageUrl?: string;

  @ApiPropertyOptional({
    enum: EventDrinkCategory,
    default: EventDrinkCategory.BOTH,
  })
  @IsOptional()
  @IsEnum(EventDrinkCategory)
  drinkCategory?: EventDrinkCategory;

  @ApiPropertyOptional({ enum: EventPrivacy, default: EventPrivacy.PUBLIC })
  @IsOptional()
  @IsEnum(EventPrivacy)
  privacy?: EventPrivacy;
}
