import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RsvpDecisionDto {
  @ApiPropertyOptional({
    description: 'Optional note sent to the padi with the decision',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  note?: string;
}
