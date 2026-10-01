import { ApiProperty } from '@nestjs/swagger';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { IsObject } from 'class-validator';

export class RegistrationVerifyDto {
  // The shape is the browser's PublicKeyCredential JSON, verified
  // cryptographically by @simplewebauthn/server — not worth re-validating
  // field-by-field here.
  @ApiProperty({ type: Object })
  @IsObject()
  response: RegistrationResponseJSON;
}
