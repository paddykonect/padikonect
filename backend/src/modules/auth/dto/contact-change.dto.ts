import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, Matches } from 'class-validator';

export class RequestContactChangeDto {
  @ApiPropertyOptional({ description: 'New email address' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ description: 'New Nigerian mobile, +234XXXXXXXXXX' })
  @IsOptional()
  @Matches(/^\+234[1-9]\d{9}$/, {
    message: 'phone must be a valid +234 number',
  })
  phone?: string;
}

export class VerifyContactChangeDto {
  @ApiProperty({ example: '123456' })
  @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}
