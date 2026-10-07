import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
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
}
