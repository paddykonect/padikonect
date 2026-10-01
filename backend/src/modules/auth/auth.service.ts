import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { AccountStatus, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import Redis from 'ioredis';
import { AppException } from '../../common/exceptions/app.exception';
import { REDIS_CLIENT } from '../../database/redis.module';
import { PrismaService } from '../../database/prisma.service';
import { MailerService } from '../../integrations/mailer/mailer.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { LockoutService } from './lockout.service';
import { OtpService } from './otp.service';
import { CreateSessionResult, SessionService } from './session.service';
import { TokenService } from './token.service';

const BCRYPT_ROUNDS = 12;

export interface RequestMeta {
  userAgent?: string;
  ipAddress?: string;
}

export interface PublicUser {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  role: string;
  status: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PublicUser;
}

function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    fullName: user.fullName,
    phone: user.phone,
    email: user.email,
    role: user.role,
    status: user.status,
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    private readonly lockout: LockoutService,
    private readonly mailer: MailerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async signup(dto: SignupDto): Promise<{ pendingToken: string }> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.phone }, { email: dto.email }] },
    });

    let userId: string;

    if (existing) {
      if (existing.status !== AccountStatus.PENDING_VERIFICATION) {
        throw new AppException(
          'ACCOUNT_EXISTS',
          'An account with this phone or email already exists. Please log in instead.',
          HttpStatus.CONFLICT,
        );
      }
      if (existing.phone !== dto.phone || existing.email !== dto.email) {
        throw new AppException(
          'ACCOUNT_EXISTS',
          'This phone number or email is already in use.',
          HttpStatus.CONFLICT,
        );
      }
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      await this.prisma.user.update({
        where: { id: existing.id },
        data: { fullName: dto.fullName, passwordHash },
      });
      userId = existing.id;
    } else {
      const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
      const user = await this.prisma.user.create({
        data: {
          fullName: dto.fullName,
          phone: dto.phone,
          email: dto.email,
          passwordHash,
          status: AccountStatus.PENDING_VERIFICATION,
        },
      });
      userId = user.id;
    }

    const code = await this.otp.create(userId, 'SIGNUP_VERIFICATION');
    await this.mailer.sendOtp(dto.email, code, 'signup');

    return {
      pendingToken: this.tokens.signPendingToken(userId, 'SIGNUP_VERIFICATION'),
    };
  }

  async resendSignupOtp(dto: ResendOtpDto): Promise<void> {
    const userId = this.tokens.verifyPendingToken(
      dto.pendingToken,
      'SIGNUP_VERIFICATION',
    );
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const code = await this.otp.resend(userId, 'SIGNUP_VERIFICATION');
    await this.mailer.sendOtp(user.email, code, 'signup');
  }

  async verifySignupOtp(
    dto: VerifyOtpDto,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const userId = this.tokens.verifyPendingToken(
      dto.pendingToken,
      'SIGNUP_VERIFICATION',
    );
    await this.otp.verify(userId, 'SIGNUP_VERIFICATION', dto.code);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { status: AccountStatus.ACTIVE, lastLoginAt: new Date() },
    });

    return this.issueTokens(user, false, meta);
  }

  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<
    AuthTokens | { requiresVerification: true; pendingToken: string }
  > {
    await this.lockout.assertNotLocked(dto.identifier);

    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.identifier }, { email: dto.identifier }] },
    });

    if (!user) {
      await this.lockout.recordFailure(dto.identifier);
      throw new AppException(
        'INVALID_CREDENTIALS',
        'Incorrect password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );
    if (!passwordMatches) {
      await this.lockout.recordFailure(dto.identifier);
      throw new AppException(
        'INVALID_CREDENTIALS',
        'Incorrect password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.lockout.recordSuccess(dto.identifier);

    if (user.status === AccountStatus.PENDING_VERIFICATION) {
      const code = await this.otp.create(user.id, 'SIGNUP_VERIFICATION');
      await this.mailer.sendOtp(user.email, code, 'signup');
      return {
        requiresVerification: true,
        pendingToken: this.tokens.signPendingToken(
          user.id,
          'SIGNUP_VERIFICATION',
        ),
      };
    }

    if (user.status !== AccountStatus.ACTIVE) {
      throw new AppException(
        'ACCOUNT_NOT_ACTIVE',
        'Your account is not active. Please contact support.',
        HttpStatus.FORBIDDEN,
        {
          status: user.status,
        },
      );
    }

    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(updated, dto.keepMeLoggedIn ?? false, meta);
  }

  async refresh(
    presentedToken: string,
    meta: RequestMeta,
  ): Promise<{
    accessToken: string;
    refreshToken: string;
    refreshTokenExpiresAt: Date;
  }> {
    const { userId, refreshToken } = await this.sessions.rotate(
      presentedToken,
      meta,
    );
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });

    if (user.status !== AccountStatus.ACTIVE) {
      throw new AppException(
        'ACCOUNT_NOT_ACTIVE',
        'Your account is not active.',
        HttpStatus.FORBIDDEN,
      );
    }

    const session = await this.prisma.session.findFirstOrThrow({
      where: { userId, revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      status: user.status,
    });
    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
    };
  }

  async logout(presentedToken: string): Promise<void> {
    await this.sessions.revoke(presentedToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessions.revokeAllForUser(userId);
    await this.markSessionsRevoked(userId);
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<{ pendingToken: string }> {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: dto.identifier }, { email: dto.identifier }] },
    });

    // Always behaves the same whether or not the account exists — avoids enumeration.
    if (!user) {
      const fakeUserId = randomUUID();
      return {
        pendingToken: this.tokens.signPendingToken(
          fakeUserId,
          'PASSWORD_RESET',
        ),
      };
    }

    const code = await this.otp.create(user.id, 'PASSWORD_RESET');
    await this.mailer.sendOtp(user.email, code, 'password-reset');
    return {
      pendingToken: this.tokens.signPendingToken(user.id, 'PASSWORD_RESET'),
    };
  }

  async resendPasswordResetOtp(dto: ResendOtpDto): Promise<void> {
    const userId = this.tokens.verifyPendingToken(
      dto.pendingToken,
      'PASSWORD_RESET',
    );
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return; // fake userId from a non-existent-account forgot-password call
    const code = await this.otp.resend(userId, 'PASSWORD_RESET');
    await this.mailer.sendOtp(user.email, code, 'password-reset');
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const userId = this.tokens.verifyPendingToken(
      dto.pendingToken,
      'PASSWORD_RESET',
    );
    await this.otp.verify(userId, 'PASSWORD_RESET', dto.code);

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    await this.sessions.revokeAllForUser(userId);
    await this.markSessionsRevoked(userId);
  }

  private async markSessionsRevoked(userId: string): Promise<void> {
    // Bounds how long an already-issued access token stays valid after a
    // revocation event — checked by JwtAuthGuard on every request.
    await this.redis.set(`revoked:${userId}`, '1', 'EX', 15 * 60);
  }

  private async issueTokens(
    user: User,
    keepMeLoggedIn: boolean,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      status: user.status,
    });
    const { refreshToken, session }: CreateSessionResult =
      await this.sessions.create(user.id, keepMeLoggedIn, meta);
    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
      user: toPublicUser(user),
    };
  }
}
