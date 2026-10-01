import { ApiProperty } from '@nestjs/swagger';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

export class AuthenticationVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  flowId: string;

  // The shape is the browser's PublicKeyCredential JSON, verified
  // cryptographically by @simplewebauthn/server — not worth re-validating
  // field-by-field here.
  @ApiProperty({ type: Object })
  @IsObject()
  response: AuthenticationResponseJSON;
}
