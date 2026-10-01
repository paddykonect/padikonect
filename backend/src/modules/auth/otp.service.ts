import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import Redis from 'ioredis';
import { AppException } from '../../common/exceptions/app.exception';
import { generateOtpCode, hmacSha256Hex } from '../../common/utils/crypto.util';
import { REDIS_CLIENT } from '../../database/redis.module';
import { PrismaService } from '../../database/prisma.service';

const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_SECONDS = 30;
const RESEND_CAP_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private hash(code: string): string {
    const pepper = this.config.get<string>('otp.hashPepper') as string;
    return hmacSha256Hex(code, pepper);
  }

  private cooldownKey(userId: string, purpose: OtpPurpose) {
    return `otp:cooldown:${userId}:${purpose}`;
  }

  private capKey(userId: string, purpose: OtpPurpose) {
    return `otp:resend-cap:${userId}:${purpose}`;
  }

  /** Initial issuance (signup, forgot-password). Invalidates any stale unconsumed row first. */
  async create(userId: string, purpose: OtpPurpose): Promise<string> {
    await this.prisma.otpVerification.updateMany({
      where: { userId, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    const code = generateOtpCode();
    await this.prisma.otpVerification.create({
      data: {
        userId,
        purpose,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });
    await this.redis.set(
      this.cooldownKey(userId, purpose),
      '1',
      'EX',
      RESEND_COOLDOWN_SECONDS,
    );
    return code;
  }

  async resend(userId: string, purpose: OtpPurpose): Promise<string> {
    const onCooldown = await this.redis.get(this.cooldownKey(userId, purpose));
    if (onCooldown) {
      throw new AppException(
        'OTP_RESEND_COOLDOWN',
        `Please wait a few seconds before requesting another code.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const resendCount = await this.redis.incr(this.capKey(userId, purpose));
    if (resendCount === 1) {
      await this.redis.expire(this.capKey(userId, purpose), 3600);
    }
    if (resendCount > RESEND_CAP_PER_HOUR) {
      throw new AppException(
        'OTP_RESEND_LIMIT',
        'Too many code requests. Please try again in an hour.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const existing = await this.prisma.otpVerification.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      throw new AppException(
        'OTP_NOT_FOUND',
        'No pending verification found. Please start again.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const code = generateOtpCode();
    await this.prisma.otpVerification.update({
      where: { id: existing.id },
      data: {
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
        attemptCount: 0,
        resendCount: { increment: 1 },
        lastSentAt: new Date(),
      },
    });
    await this.redis.set(
      this.cooldownKey(userId, purpose),
      '1',
      'EX',
      RESEND_COOLDOWN_SECONDS,
    );
    return code;
  }

  async verify(
    userId: string,
    purpose: OtpPurpose,
    code: string,
  ): Promise<void> {
    const existing = await this.prisma.otpVerification.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!existing) {
      throw new AppException(
        'OTP_NOT_FOUND',
        'No pending verification found. Please start again.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (existing.expiresAt < new Date()) {
      throw new AppException(
        'OTP_EXPIRED',
        'This code has expired. Please request a new one.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (existing.attemptCount >= MAX_VERIFY_ATTEMPTS) {
      throw new AppException(
        'OTP_TOO_MANY_ATTEMPTS',
        'Too many incorrect attempts. Please request a new code.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (this.hash(code) !== existing.codeHash) {
      await this.prisma.otpVerification.update({
        where: { id: existing.id },
        data: { attemptCount: { increment: 1 } },
      });
      const remaining = MAX_VERIFY_ATTEMPTS - existing.attemptCount - 1;
      throw new AppException(
        'OTP_INCORRECT',
        `Incorrect code. ${remaining > 0 ? `${remaining} attempts remaining.` : 'No attempts remaining — please request a new code.'}`,
        HttpStatus.BAD_REQUEST,
        { remainingAttempts: Math.max(remaining, 0) },
      );
    }

    await this.prisma.otpVerification.update({
      where: { id: existing.id },
      data: { consumedAt: new Date() },
    });
  }
}
