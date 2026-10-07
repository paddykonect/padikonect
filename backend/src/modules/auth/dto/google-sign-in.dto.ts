import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

export class GoogleSignInDto {
  @ApiProperty({
    description: 'Google ID token (credential) from Google Identity Services',
  })
  @IsString()
  @MinLength(1)
  idToken!: string;

  // Required only when this Google account has no Paddykonect account yet —
  // same 18+/Terms consent the email signup collects.
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  ageConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  termsAccepted?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  keepMeLoggedIn?: boolean;
}
