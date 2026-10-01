import { ApiPropertyOptional } from '@nestjs/swagger';
import { DrinkPreference } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProfileDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  displayName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(280)
  bio?: string;

  @ApiPropertyOptional({ enum: DrinkPreference })
  @IsOptional()
  @IsEnum(DrinkPreference)
  drinkPreference?: DrinkPreference;

  @ApiPropertyOptional({
    type: [String],
    description: 'Interest tags (Taste Picker)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(30, { each: true })
  interests?: string[];

  @ApiPropertyOptional({ description: 'Country of residence (onboarding)' })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  country?: string;

  @ApiPropertyOptional({
    description: 'Nationality, if confirmed distinct from country of residence',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  nationality?: string;

  @ApiPropertyOptional({
    description: 'State of residence (onboarding, Nigeria only)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;
}
