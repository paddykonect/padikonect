import { createHmac, randomBytes, randomInt } from 'crypto';

/** Keyed hash (not a plain digest) so stored hashes are useless without the server-side secret. */
export function hmacSha256Hex(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('hex');
}

/** 6-digit numeric OTP. Uses crypto.randomInt, not Math.random. */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/** Opaque refresh token — a random string, never a JWT. */
export function generateOpaqueToken(bytes = 48): string {
  return randomBytes(bytes).toString('hex');
}
