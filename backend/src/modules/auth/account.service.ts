import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AccountStatus, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import Redis from 'ioredis';
import { AppException } from '../../common/exceptions/app.exception';
import { REDIS_CLIENT } from '../../database/redis.module';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../integrations/mailer/mailer.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RequestMeta } from './auth.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RequestContactChangeDto } from './dto/contact-change.dto';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { TokenService } from './token.service';

const BCRYPT_ROUNDS = 12;
// Matches the OTP lifetime (otp.service.ts OTP_TTL_MS).
const CONTACT_CHANGE_TTL_SECONDS = 10 * 60;

interface PendingContactChange {
  email?: string;
  phone?: string;
}

const contactChangeKey = (userId: string) => `contact-change:${userId}`;

/** "ju•••@example.com" — enough for the user to recognise where the code went. */
function maskEmail(email: string): string {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}•••@${domain}`;
}

// Settings > Account: password, phone & email, and deleting the account.
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly mailer: MailerService,
    private readonly notifications: NotificationsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /**
   * Signs every other device out (their refresh sessions are revoked now;
   * their short-lived access tokens lapse within the access TTL) and hands
   * this device a fresh session so it stays signed in.
   */
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    meta: RequestMeta,
  ) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    if (!user.passwordHash) {
      throw new AppException(
        'NO_PASSWORD',
        'Your account signs in with Google. Use "Forgot password" to set a password.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (!(await bcrypt.compare(dto.currentPassword, user.passwordHash))) {
      throw new AppException(
        'INVALID_CURRENT_PASSWORD',
        'Your current password is incorrect.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new AppException(
        'PASSWORD_UNCHANGED',
        'Choose a password different from your current one.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
    await this.sessions.revokeAllForUser(userId);

    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      status: user.status,
    });
    const { refreshToken, session } = await this.sessions.create(
      userId,
      false,
      meta,
    );
    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    };
  }

  /**
   * Step 1 of changing phone/email: nothing is saved until the code is
   * confirmed. The code goes to the new email when the email changes (proving
   * it's yours), otherwise to the email already on file.
   */
  async requestContactChange(
    userId: string,
    dto: RequestContactChangeDto,
  ): Promise<{ sentTo: string }> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const email = dto.email?.trim().toLowerCase();
    const pending: PendingContactChange = {
      ...(email && email !== user.email.toLowerCase() && { email }),
      ...(dto.phone && dto.phone !== user.phone && { phone: dto.phone }),
    };
    if (!pending.email && !pending.phone) {
      throw new AppException(
        'NO_CHANGES',
        "That's already your phone number and email.",
        HttpStatus.BAD_REQUEST,
      );
    }
    await this.assertAvailable(userId, pending);

    const code = await this.otp.create(userId, 'CONTACT_CHANGE');
    await this.redis.set(
      contactChangeKey(userId),
      JSON.stringify(pending),
      'EX',
      CONTACT_CHANGE_TTL_SECONDS,
    );
    const to = pending.email ?? user.email;
    await this.mailer.sendOtp(to, code, 'contact-change');
    return { sentTo: maskEmail(to) };
  }

  async resendContactChange(userId: string): Promise<{ sentTo: string }> {
    const pending = await this.getPending(userId);
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const code = await this.otp.resend(userId, 'CONTACT_CHANGE');
    const to = pending.email ?? user.email;
    await this.mailer.sendOtp(to, code, 'contact-change');
    return { sentTo: maskEmail(to) };
  }

  /** Step 2: the code checks out — save the new details. */
  async verifyContactChange(userId: string, code: string) {
    const pending = await this.getPending(userId);
    await this.otp.verify(userId, 'CONTACT_CHANGE', code);
    try {
      const user = await this.prisma.user.update({
        where: { id: userId },
        data: pending,
        select: { email: true, phone: true },
      });
      await this.redis.del(contactChangeKey(userId));
      return user;
    } catch (err) {
      // Someone else claimed the email/phone between request and verify.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new AppException(
          'CONTACT_IN_USE',
          'That phone number or email is now used by another account.',
          HttpStatus.CONFLICT,
        );
      }
      throw err;
    }
  }

  /**
   * Deletes the account: the login identifiers and personal details are wiped
   * (so the phone/email can sign up again), connections and personal content
   * are removed, upcoming hangouts they host are cancelled, and every session
   * ends immediately. The User row stays as an anonymous "Deleted user" so
   * shared history (group chat messages, past hangouts) stays consistent.
   */
  async deleteAccount(userId: string): Promise<void> {
    const now = new Date();
    const upcomingHosted = await this.prisma.event.findMany({
      where: { hostId: userId, status: 'PUBLISHED', startAt: { gt: now } },
      select: { id: true, title: true },
    });
    const affected = await this.prisma.rsvp.findMany({
      where: {
        eventId: { in: upcomingHosted.map((e) => e.id) },
        status: { in: ['APPROVED', 'REQUESTED', 'WAITLISTED'] },
      },
      select: { userId: true, eventId: true },
    });

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          status: AccountStatus.DELETED,
          deletedAt: now,
          fullName: 'Deleted user',
          email: `deleted+${userId}@deleted.padikonect.invalid`,
          phone: null,
          googleId: null,
          passwordHash: null,
        },
      }),
      this.prisma.profile.updateMany({
        where: { userId },
        data: {
          displayName: null,
          photoUrl: null,
          photoPublicId: null,
          bio: null,
          interests: [],
          country: null,
          nationality: null,
          state: null,
        },
      }),
      this.prisma.padiConnection.deleteMany({
        where: { OR: [{ userId }, { padiId: userId }] },
      }),
      this.prisma.block.deleteMany({
        where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
      }),
      this.prisma.padiStatus.deleteMany({ where: { userId } }),
      this.prisma.venueFavorite.deleteMany({ where: { userId } }),
      this.prisma.webauthnCredential.deleteMany({ where: { userId } }),
      this.prisma.liveLocation.deleteMany({ where: { userId } }),
      this.prisma.event.updateMany({
        where: { id: { in: upcomingHosted.map((e) => e.id) } },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          cancelReason: 'The host deleted their account.',
        },
      }),
      // Their own upcoming RSVPs elsewhere.
      this.prisma.rsvp.updateMany({
        where: {
          userId,
          status: { in: ['APPROVED', 'REQUESTED', 'WAITLISTED'] },
          event: { startAt: { gt: now } },
        },
        data: { status: 'CANCELLED' },
      }),
    ]);

    await this.sessions.revokeAllForUser(userId);
    // Kill already-issued access tokens too (checked by JwtAuthGuard).
    await this.redis.set(`revoked:${userId}`, '1', 'EX', 15 * 60);
    await this.redis.del(contactChangeKey(userId));

    for (const event of upcomingHosted) {
      await this.notifications.notifyMany(
        affected.filter((a) => a.eventId === event.id).map((a) => a.userId),
        'EVENT_CANCELLED',
        `"${event.title}" was cancelled`,
        'The host deleted their account.',
        { eventId: event.id },
      );
    }
  }

  private async getPending(userId: string): Promise<PendingContactChange> {
    const raw = await this.redis.get(contactChangeKey(userId));
    if (!raw) {
      throw new AppException(
        'OTP_NOT_FOUND',
        'No pending change found. Please start again.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return JSON.parse(raw) as PendingContactChange;
  }

  private async assertAvailable(
    userId: string,
    pending: PendingContactChange,
  ): Promise<void> {
    const clash = await this.prisma.user.findFirst({
      where: {
        id: { not: userId },
        OR: [
          ...(pending.email ? [{ email: pending.email }] : []),
          ...(pending.phone ? [{ phone: pending.phone }] : []),
        ],
      },
      select: { email: true },
    });
    if (clash) {
      const emailClash = pending.email && clash.email === pending.email;
      throw new AppException(
        emailClash ? 'EMAIL_IN_USE' : 'PHONE_IN_USE',
        emailClash
          ? 'That email is already used by another account.'
          : 'That phone number is already used by another account.',
        HttpStatus.CONFLICT,
      );
    }
  }
}
