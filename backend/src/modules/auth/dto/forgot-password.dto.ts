import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Phone (+234...) or email' })
  @IsString()
  identifier!: string;
}
