import { z } from 'zod';

// Grows phase by phase — only validate what's actually consumed at boot.
// Phase 5 adds PAYSTACK_*/FLUTTERWAVE_*.
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  API_PREFIX: z.string().default('api'),
  CORS_ORIGIN: z.string().default('*'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
  SENTRY_DSN: z.string().optional().default(''),

  // --- Phase 1: Auth/Identity ---
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z
    .string()
    .min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DEFAULT: z.string().default('24h'),
  JWT_REFRESH_TTL_EXTENDED: z.string().default('60d'),
  OTP_HASH_PEPPER: z
    .string()
    .min(16, 'OTP_HASH_PEPPER must be at least 16 characters'),
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASSWORD: z.string().optional().default(''),
  SMTP_SECURE: z.coerce.boolean().default(false),
  MAIL_FROM: z.string().default('Paddykonect <no-reply@paddykonect.com>'),

  // --- Phase 2: Profile / Cloudinary ---
  // Optional at boot (unlike the JWT/OTP secrets, these can't be self-generated —
  // they come from a real Cloudinary account). CloudinaryService throws a clear
  // error at call-time if a signed-upload endpoint is hit before they're set.
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(''),
  CLOUDINARY_API_KEY: z.string().optional().default(''),
  CLOUDINARY_API_SECRET: z.string().optional().default(''),

  // --- Phase 4: Padi Board / Events ---
  // Also optional — a real third-party account, same reasoning as Cloudinary above.
  GOOGLE_MAPS_API_KEY: z.string().optional().default(''),

  // --- Biometric login (WebAuthn/passkeys) — Figma-only addition, not a
  // numbered phase. RP_ID/ORIGIN must match the frontend's real host in
  // every environment (WebAuthn hard-fails on a mismatch by design).
  WEBAUTHN_RP_NAME: z.string().default('Paddykonect'),
  WEBAUTHN_RP_ID: z.string().default('localhost'),
  WEBAUTHN_ORIGIN: z.string().default('http://localhost:3001'),
});

export type EnvConfig = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const formatted = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}
