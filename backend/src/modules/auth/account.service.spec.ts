/* eslint-disable @typescript-eslint/no-unsafe-member-access -- untyped jest.fn() mock.calls */
/* eslint-disable @typescript-eslint/unbound-method -- jest.fn() mocks on plain object literals */
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../integrations/mailer/mailer.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountService } from './account.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

function makeService(user: Record<string, unknown>) {
  const prisma = {
    user: {
      findUniqueOrThrow: jest.fn().mockResolvedValue(user),
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({ email: 'x', phone: null }),
    },
  } as unknown as PrismaService;
  const otp = {
    create: jest.fn().mockResolvedValue('123456'),
    verify: jest.fn(),
  } as unknown as OtpService;
  const sessions = {
    revokeAllForUser: jest.fn(),
    create: jest.fn().mockResolvedValue({
      refreshToken: 'r',
      session: { expiresAt: new Date() },
    }),
  } as unknown as SessionService;
  const tokens = {
    signAccessToken: jest.fn().mockReturnValue('a'),
  } as unknown as TokenService;
  const mailer = { sendOtp: jest.fn() } as unknown as MailerService;
  const store = new Map<string, string>();
  const redis = {
    set: jest.fn((k: string, v: string) => store.set(k, v)),
    get: jest.fn((k: string) => store.get(k) ?? null),
    del: jest.fn((k: string) => store.delete(k)),
  } as unknown as Redis;
  const service = new AccountService(
    prisma,
    otp,
    sessions,
    tokens,
    mailer,
    {} as NotificationsService,
    redis,
  );
  return { service, prisma, otp, sessions, mailer };
}

describe('AccountService', () => {
  describe('changePassword', () => {
    const meta = {};
    it('rejects a wrong current password', async () => {
      const hash = await bcrypt.hash('Correct123!', 4);
      const { service } = makeService({ id: 'u1', passwordHash: hash });
      await expect(
        service.changePassword(
          'u1',
          { currentPassword: 'nope', newPassword: 'NewPass123!' },
          meta,
        ),
      ).rejects.toMatchObject({ code: 'INVALID_CURRENT_PASSWORD' });
    });

    it('tells Google-only accounts to use forgot password', async () => {
      const { service } = makeService({ id: 'u1', passwordHash: null });
      await expect(
        service.changePassword(
          'u1',
          { currentPassword: 'x', newPassword: 'NewPass123!' },
          meta,
        ),
      ).rejects.toMatchObject({ code: 'NO_PASSWORD' });
    });

    it('saves the new password, signs out other sessions and issues a fresh one', async () => {
      const hash = await bcrypt.hash('Correct123!', 4);
      const { service, prisma, sessions } = makeService({
        id: 'u1',
        passwordHash: hash,
        role: 'MEMBER',
        status: 'ACTIVE',
      });
      const result = await service.changePassword(
        'u1',
        { currentPassword: 'Correct123!', newPassword: 'NewPass123!' },
        meta,
      );
      const saved = (prisma.user.update as jest.Mock).mock.calls[0][0] as {
        data: { passwordHash: string };
      };
      expect(await bcrypt.compare('NewPass123!', saved.data.passwordHash)).toBe(
        true,
      );
      expect(sessions.revokeAllForUser).toHaveBeenCalledWith('u1');
      expect(sessions.create).toHaveBeenCalled();
      expect(result.accessToken).toBe('a');
    });
  });

  describe('contact change', () => {
    const user = {
      id: 'u1',
      email: 'old@example.com',
      phone: '+2348011111111',
    };

    it('rejects a request that changes nothing', async () => {
      const { service } = makeService(user);
      await expect(
        service.requestContactChange('u1', {
          email: 'OLD@example.com',
          phone: '+2348011111111',
        }),
      ).rejects.toMatchObject({ code: 'NO_CHANGES' });
    });

    it('rejects an email another account already uses', async () => {
      const { service, prisma } = makeService(user);
      (prisma.user.findFirst as jest.Mock).mockResolvedValue({
        email: 'new@example.com',
      });
      await expect(
        service.requestContactChange('u1', { email: 'new@example.com' }),
      ).rejects.toMatchObject({ code: 'EMAIL_IN_USE' });
    });

    it('sends the code to the new email and saves nothing until verified', async () => {
      const { service, prisma, mailer } = makeService(user);
      const res = await service.requestContactChange('u1', {
        email: 'New@Example.com',
      });
      expect(mailer.sendOtp).toHaveBeenCalledWith(
        'new@example.com',
        '123456',
        'contact-change',
      );
      expect(res.sentTo).toBe('ne•••@example.com');
      expect(prisma.user.update).not.toHaveBeenCalled();

      await service.verifyContactChange('u1', '123456');
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { email: 'new@example.com' } }),
      );
    });

    it('sends a phone-only change code to the email on file', async () => {
      const { service, mailer } = makeService(user);
      await service.requestContactChange('u1', { phone: '+2348022222222' });
      expect(mailer.sendOtp).toHaveBeenCalledWith(
        'old@example.com',
        '123456',
        'contact-change',
      );
    });

    it('refuses to verify when nothing is pending', async () => {
      const { service } = makeService(user);
      await expect(
        service.verifyContactChange('u1', '123456'),
      ).rejects.toMatchObject({ code: 'OTP_NOT_FOUND' });
    });
  });
});
