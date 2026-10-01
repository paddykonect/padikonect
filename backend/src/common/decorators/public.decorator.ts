import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Opts a route out of the global JwtAuthGuard (registered in Phase 1's auth module).
 * Used for signup/login/OTP/forgot-password/webhooks/health/Swagger.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
