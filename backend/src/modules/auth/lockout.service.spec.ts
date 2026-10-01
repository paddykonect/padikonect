import { LockoutService } from './lockout.service';

function makeMockRedis() {
  return {
    get: jest.fn(),
    incr: jest.fn(),
    expire: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };
}

describe('LockoutService', () => {
  it('assertNotLocked resolves when there is no lockout key', async () => {
    const redis = makeMockRedis();
    redis.get.mockResolvedValue(null);
    const service = new LockoutService(redis as never);

    await expect(
      service.assertNotLocked('user@example.com'),
    ).resolves.toBeUndefined();
  });

  it('assertNotLocked throws ACCOUNT_LOCKED with a retryAfterSeconds param when locked', async () => {
    const redis = makeMockRedis();
    const lockedUntil = Date.now() + 5 * 60 * 1000;
    redis.get.mockResolvedValue(lockedUntil.toString());
    const service = new LockoutService(redis as never);

    await expect(
      service.assertNotLocked('user@example.com'),
    ).rejects.toMatchObject({
      code: 'ACCOUNT_LOCKED',
      params: { retryAfterSeconds: expect.any(Number) as number },
    });
  });

  it('recordFailure sets an expiry only on the first failure', async () => {
    const redis = makeMockRedis();
    redis.incr.mockResolvedValue(1);
    const service = new LockoutService(redis as never);

    await service.recordFailure('user@example.com');

    expect(redis.expire).toHaveBeenCalledTimes(1);
  });

  it('recordFailure locks the account and clears the counter once attempts reach the threshold', async () => {
    const redis = makeMockRedis();
    redis.incr.mockResolvedValue(5);
    const service = new LockoutService(redis as never);

    await service.recordFailure('user@example.com');

    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('login:lockout:'),
      expect.any(String),
      'EX',
      expect.any(Number),
    );
    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('login:fail:'),
    );
  });

  it('recordSuccess clears both the failure counter and any lockout', async () => {
    const redis = makeMockRedis();
    const service = new LockoutService(redis as never);

    await service.recordSuccess('user@example.com');

    expect(redis.del).toHaveBeenCalledWith(
      expect.stringContaining('login:fail:'),
      expect.stringContaining('login:lockout:'),
    );
  });
});
