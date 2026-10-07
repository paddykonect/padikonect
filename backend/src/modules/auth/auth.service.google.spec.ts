/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain
   object literals, not real bound class methods; the rule can't tell */
import { AccountStatus } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../integrations/mailer/mailer.service';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './google-auth.service';
import { LockoutService } from './lockout.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

const identity = {
  googleId: 'g-123',
  email: 'ada@example.com',
  name: 'Ada Obi',
};

function user(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'user-1',
    fullName: 'Ada Obi',
    phone: null,
    email: 'ada@example.com',
    passwordHash: null,
    googleId: null,
    role: 'MEMBER',
    status: AccountStatus.ACTIVE,
    ...overrides,
  };
}

function makeService(existing: ReturnType<typeof user> | null) {
  const prisma = {
    user: {
      findFirst: jest.fn().mockResolvedValue(existing),
      update: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve({ ...existing, ...data }),
        ),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: object }) =>
          Promise.resolve(user({ id: 'user-new', ...data })),
        ),
    },
  } as unknown as PrismaService;
  const sessions = {
    create: jest.fn().mockResolvedValue({
      refreshToken: 'refresh',
      session: { expiresAt: new Date() },
    }),
  } as unknown as SessionService;
  const tokens = {
    signAccessToken: jest.fn().mockReturnValue('access'),
  } as unknown as TokenService;
  const google = {
    verify: jest.fn().mockResolvedValue(identity),
  } as unknown as GoogleAuthService;

  const service = new AuthService(
    prisma,
    {} as OtpService,
    sessions,
    tokens,
    {} as LockoutService,
    {} as MailerService,
    google,
    {} as Redis,
  );
  return { service, prisma };
}

describe('AuthService.googleSignIn', () => {
  it('links and activates an existing email account (Google verified the email)', async () => {
    const { service, prisma } = makeService(
      user({ status: AccountStatus.PENDING_VERIFICATION }),
    );
    const result = await service.googleSignIn({ idToken: 't' }, {});
    expect(result.isNewUser).toBe(false);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          googleId: 'g-123',
          status: AccountStatus.ACTIVE,
        }) as object,
      }),
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates an active account for a new Google user who gave consent', async () => {
    const { service, prisma } = makeService(null);
    const result = await service.googleSignIn(
      { idToken: 't', ageConfirmed: true, termsAccepted: true },
      {},
    );
    expect(result.isNewUser).toBe(true);
    expect(result.user.phone).toBeNull();
    expect(prisma.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'ada@example.com',
        googleId: 'g-123',
        status: AccountStatus.ACTIVE,
      }) as object,
    });
  });

  it('refuses to create an account without 18+/Terms consent', async () => {
    const { service, prisma } = makeService(null);
    await expect(service.googleSignIn({ idToken: 't' }, {})).rejects.toThrow(
      /18\+/,
    );
    expect(prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses an email already linked to a different Google account', async () => {
    const { service } = makeService(user({ googleId: 'g-other' }));
    await expect(service.googleSignIn({ idToken: 't' }, {})).rejects.toThrow(
      /different Google account/,
    );
  });

  it('refuses suspended accounts', async () => {
    const { service } = makeService(user({ status: AccountStatus.SUSPENDED }));
    await expect(service.googleSignIn({ idToken: 't' }, {})).rejects.toThrow(
      /not active/,
    );
  });
});
