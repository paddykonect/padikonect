import { ApiPropertyOptional } from '@nestjs/swagger';
import { DrinkPreference, InvitePolicy } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
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

  @ApiPropertyOptional({
    description: 'Profile card "Wants to be invited for" free-text hint',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  wantsToBeInvitedFor?: string;

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
    description: 'State of residence (onboarding)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  state?: string;

  @ApiPropertyOptional({ description: 'Nigerian mobile, +234XXXXXXXXXX' })
  @IsOptional()
  @Matches(/^\+234[1-9]\d{9}$/, {
    message: 'phone must be a valid +234 number',
  })
  phone?: string;

  @ApiPropertyOptional({
    enum: InvitePolicy,
    description: 'Settings > Who can invite me',
  })
  @IsOptional()
  @IsEnum(InvitePolicy)
  invitePolicy?: InvitePolicy;

  @ApiPropertyOptional({ description: 'Settings > Push notifications' })
  @IsOptional()
  @IsBoolean()
  pushNotifications?: boolean;

  @ApiPropertyOptional({
    description: 'Settings > Location services (PadiRadar & nearby discovery)',
  })
  @IsOptional()
  @IsBoolean()
  locationServices?: boolean;
}
