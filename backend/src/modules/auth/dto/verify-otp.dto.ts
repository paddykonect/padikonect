import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

export class VerifyOtpDto {
  @ApiProperty()
  @IsString()
  pendingToken!: string;

  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
