import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { MediaType, PostType } from '@prisma/client';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class PostMediaInputDto {
  @ApiProperty()
  @IsUrl({ protocols: ['https'], require_protocol: true })
  url!: string;

  @ApiProperty()
  @IsString()
  publicId!: string;

  @ApiProperty({ enum: MediaType })
  @IsEnum(MediaType)
  type!: MediaType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  width?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  height?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  durationMs?: number;
}

export class CreatePostDto {
  @ApiPropertyOptional({ enum: PostType, default: PostType.MOMENT })
  @IsOptional()
  @IsEnum(PostType)
  type?: PostType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  caption?: string;

  @ApiPropertyOptional({ type: [PostMediaInputDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PostMediaInputDto)
  media?: PostMediaInputDto[];
}
