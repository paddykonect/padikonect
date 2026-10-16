import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class ReportCommunityDto {
  @ApiPropertyOptional({ description: 'Optional reason for the report' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
