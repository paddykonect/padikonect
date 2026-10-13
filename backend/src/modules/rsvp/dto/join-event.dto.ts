import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class JoinEventDto {
  @ApiPropertyOptional({ description: 'Optional note to the host' })
  @IsOptional()
  @IsString()
  @MaxLength(280)
  message?: string;

  @ApiPropertyOptional({
    description: 'Share-link code, letting a guest join an invite-only hangout',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteCode?: string;
}
