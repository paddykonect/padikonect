import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { EventDrinkCategory, EventPrivacy, MediaType } from '@prisma/client';
import { Type } from 'class-transformer';
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
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ArrayMaxSize,
  IsArray,
  ValidateNested,
} from 'class-validator';

export class CreateEventMediaDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @IsString()
  publicId!: string;

  @IsOptional()
  @IsEnum(MediaType)
  type?: MediaType;

  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;
}

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

  @ApiPropertyOptional({
    type: [String],
    description: 'Interest tags, e.g. "Live music", "Afrobeats" (max 5)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  tags?: string[];

  @ApiPropertyOptional({
    description:
      'Host at a listed venue: location comes from the venue, and the hangout stays hidden until the venue confirms.',
  })
  @IsOptional()
  @IsUUID()
  venueId?: string;

  @ApiPropertyOptional({
    description: 'Host this hangout under a community (its Events tab).',
  })
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @ApiPropertyOptional({ enum: EventPrivacy, default: EventPrivacy.PUBLIC })
  @IsOptional()
  @IsEnum(EventPrivacy)
  privacy?: EventPrivacy;

  @ApiPropertyOptional({ description: 'Activity emoji (the "Customize" step)' })
  @IsOptional()
  @IsString()
  @MaxLength(16)
  emoji?: string;

  @ApiPropertyOptional({ description: 'Host "Introduce yourself" message' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  hostIntro?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  startingGroupSize?: number;

  @ApiPropertyOptional({
    description: 'Minimum joiners needed for the hangout',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(1000)
  minJoiners?: number;

  @ApiPropertyOptional({
    description: 'Preferred minimum joiner age (the "Age" slider)',
  })
  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(120)
  minAge?: number;

  @ApiPropertyOptional({
    description: 'Preferred maximum joiner age (the "Age" slider)',
  })
  @IsOptional()
  @IsInt()
  @Min(16)
  @Max(120)
  maxAge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(40)
  language?: string;

  @ApiPropertyOptional({
    description: 'Membership gate: min padi points to join',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  minPadiPoints?: number;

  @ApiPropertyOptional({
    type: [CreateEventMediaDto],
    description: 'Hangout photos (max 6); the first is the cover',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @ValidateNested({ each: true })
  @Type(() => CreateEventMediaDto)
  media?: CreateEventMediaDto[];
}
