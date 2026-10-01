import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import Redis from 'ioredis';
import { AppException } from '../../common/exceptions/app.exception';
import { REDIS_CLIENT } from '../../database/redis.module';

const MAX_ATTEMPTS = 5;
const FAIL_WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 15 * 60;

@Injectable()
export class LockoutService {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  private failKey(identifier: string) {
    return `login:fail:${identifier}`;
  }

  private lockoutKey(identifier: string) {
    return `login:lockout:${identifier}`;
  }

  /** Checked before attempting a credential compare — avoids a timing oracle / wasted bcrypt CPU on locked accounts. */
  async assertNotLocked(identifier: string): Promise<void> {
    const lockedUntil = await this.redis.get(this.lockoutKey(identifier));
    if (lockedUntil) {
      const retryAfterSeconds = Math.max(
        0,
        Math.ceil((parseInt(lockedUntil, 10) - Date.now()) / 1000),
      );
      throw new AppException(
        'ACCOUNT_LOCKED',
        `Too many failed attempts. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
        { retryAfterSeconds },
      );
    }
  }

  async recordFailure(identifier: string): Promise<void> {
    const key = this.failKey(identifier);
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, FAIL_WINDOW_SECONDS);
    }
    if (attempts >= MAX_ATTEMPTS) {
      const lockedUntil = Date.now() + LOCKOUT_SECONDS * 1000;
      await this.redis.set(
        this.lockoutKey(identifier),
        lockedUntil.toString(),
        'EX',
        LOCKOUT_SECONDS,
      );
      await this.redis.del(key);
    }
  }

  async recordSuccess(identifier: string): Promise<void> {
    await this.redis.del(this.failKey(identifier), this.lockoutKey(identifier));
  }
}
