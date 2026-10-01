import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Base exception for all domain errors. Carries a stable machine-readable `code`
 * (e.g. PREMIUM_REQUIRED, VERIFICATION_IN_REVIEW) so clients can branch on it
 * instead of parsing English error strings — keeps localized/Pidgin copy a
 * client-side concern.
 */
export class AppException extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly params?: Record<string, unknown>,
  ) {
    super({ code, message, params }, status);
  }
}
