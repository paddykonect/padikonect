import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class CheckInDto {
  @ApiProperty({ example: 'PADI-7X3K9Q' })
  @IsString()
  @Matches(/^PADI-[A-Z0-9]{6}$/i, {
    message: 'That is not a Padikonect entry pass.',
  })
  code!: string;
}
