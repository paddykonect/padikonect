import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ description: 'Phone (+234...) or email' })
  @IsString()
  identifier!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  password!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  keepMeLoggedIn?: boolean;
}
