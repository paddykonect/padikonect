import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class RefreshDto {
  // Optional in the DTO because the web client may send it via httpOnly cookie instead.
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  refreshToken?: string;
}
