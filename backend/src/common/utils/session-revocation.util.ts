import Redis from 'ioredis';

// Long enough to outlive any access token issued before the revocation.
const REVOCATION_TTL_SECONDS = 15 * 60;

const revocationKey = (userId: string) => `revoked:${userId}`;

/**
 * Records *when* a user's sessions were revoked. Only access tokens issued
 * before that moment are rejected — a fresh login right after a password
 * reset or "log out everywhere" must keep working.
 */
export async function markSessionsRevoked(
  redis: Redis,
  userId: string,
): Promise<void> {
  await redis.set(
    revocationKey(userId),
    String(Math.floor(Date.now() / 1000)),
    'EX',
    REVOCATION_TTL_SECONDS,
  );
}

export async function isTokenRevoked(
  redis: Redis,
  userId: string,
  issuedAt: number | undefined,
): Promise<boolean> {
  const revokedAt = Number(await redis.get(revocationKey(userId)));
  if (!revokedAt) return false;
  // A token without iat can't prove it postdates the revocation.
  return issuedAt === undefined || issuedAt < revokedAt;
}
