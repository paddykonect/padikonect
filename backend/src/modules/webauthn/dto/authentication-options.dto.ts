import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AuthenticationOptionsDto {
  @ApiProperty({ description: 'Phone or email of the account to authenticate' })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
