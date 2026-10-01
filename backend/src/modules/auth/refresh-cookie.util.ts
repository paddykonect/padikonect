import { Response } from 'express';

export const REFRESH_COOKIE_NAME = 'refresh_token';
// Scoped to /api (not the narrower /api/auth) since URI versioning inserts a
// /v1 segment between the global prefix and the controller path — pinning to
// a version-specific path here would silently break on the next version bump.
const COOKIE_PATH = '/api';

export function setRefreshCookie(
  res: Response,
  token: string,
  expiresAt: Date,
  nodeEnv: string,
) {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
    expires: expiresAt,
  });
}

export function clearRefreshCookie(res: Response, nodeEnv: string) {
  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure: nodeEnv === 'production',
    sameSite: 'strict',
    path: COOKIE_PATH,
  });
}
