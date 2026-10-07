import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinEventDto {
  @ApiPropertyOptional({ description: 'Optional note to the host' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;
}
