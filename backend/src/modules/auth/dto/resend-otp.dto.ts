import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ResendOtpDto {
  @ApiProperty()
  @IsString()
  pendingToken!: string;
}
