import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Max, Min } from 'class-validator';

export class RatePadiDto {
  @ApiProperty({ description: 'The shared hangout that unlocks this rating' })
  @IsUUID()
  eventId!: string;

  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  stars!: number;
}
