import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class VenueResponseDto {
  @ApiProperty({ enum: ['CONFIRMED', 'REJECTED'] })
  @IsIn(['CONFIRMED', 'REJECTED'])
  decision!: 'CONFIRMED' | 'REJECTED';

  @ApiPropertyOptional({
    description: 'Shown to the host, e.g. why it was declined',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
