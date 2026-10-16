import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateCommunityDto {
  @ApiProperty()
  @IsString()
  @MinLength(3)
  @MaxLength(60)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(10)
  @MaxLength(280)
  description!: string;

  @ApiProperty({ example: '🍽️' })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji!: string;

  @ApiPropertyOptional({
    description: "Defaults to the creator's state/country",
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  city?: string;

  @ApiPropertyOptional({ default: 18 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(99)
  minAge?: number;

  @ApiPropertyOptional({ default: 99 })
  @IsOptional()
  @IsInt()
  @Min(18)
  @Max(99)
  maxAge?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  coverImageUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  coverImagePublicId?: string;

  @ApiPropertyOptional({ type: [String], description: 'VIBE chips (max 8)' })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  vibe?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Community RULES (max 10)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(140, { each: true })
  rules?: string[];
}
