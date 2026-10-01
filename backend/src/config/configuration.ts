import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
}));

export const databaseConfig = registerAs('database', () => ({
  url: process.env.DATABASE_URL,
}));

export const redisConfig = registerAs('redis', () => ({
  url: process.env.REDIS_URL,
}));

export const sentryConfig = registerAs('sentry', () => ({
  dsn: process.env.SENTRY_DSN || undefined,
}));

export const jwtConfig = registerAs('jwt', () => ({
  accessSecret: process.env.JWT_ACCESS_SECRET,
  refreshSecret: process.env.JWT_REFRESH_SECRET,
  accessTtl: process.env.JWT_ACCESS_TTL ?? '15m',
  refreshTtlDefault: process.env.JWT_REFRESH_TTL_DEFAULT ?? '24h',
  refreshTtlExtended: process.env.JWT_REFRESH_TTL_EXTENDED ?? '60d',
}));

export const otpConfig = registerAs('otp', () => ({
  hashPepper: process.env.OTP_HASH_PEPPER,
}));

export const mailConfig = registerAs('mail', () => ({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: parseInt(process.env.SMTP_PORT ?? '1025', 10),
  user: process.env.SMTP_USER || undefined,
  password: process.env.SMTP_PASSWORD || undefined,
  secure: process.env.SMTP_SECURE === 'true',
  from: process.env.MAIL_FROM ?? 'Paddykonect <no-reply@paddykonect.com>',
}));

export const cloudinaryConfig = registerAs('cloudinary', () => ({
  cloudName: process.env.CLOUDINARY_CLOUD_NAME || undefined,
  apiKey: process.env.CLOUDINARY_API_KEY || undefined,
  apiSecret: process.env.CLOUDINARY_API_SECRET || undefined,
}));

export const googleMapsConfig = registerAs('googleMaps', () => ({
  apiKey: process.env.GOOGLE_MAPS_API_KEY || undefined,
}));

export const webauthnConfig = registerAs('webauthn', () => ({
  rpName: process.env.WEBAUTHN_RP_NAME ?? 'Paddykonect',
  rpId: process.env.WEBAUTHN_RP_ID ?? 'localhost',
  origin: process.env.WEBAUTHN_ORIGIN ?? 'http://localhost:3001',
}));
