import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import ms from '../../common/utils/ms.util';
import { AppException } from '../../common/exceptions/app.exception';
import {
  generateOpaqueToken,
  hmacSha256Hex,
} from '../../common/utils/crypto.util';
import { PrismaService } from '../../database/prisma.service';

export interface CreateSessionResult {
  refreshToken: string;
  session: { id: string; expiresAt: Date };
}

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private hashToken(token: string): string {
    const secret = this.config.get<string>('jwt.refreshSecret') as string;
    return hmacSha256Hex(token, secret);
  }

  private refreshTtlMs(keepMeLoggedIn: boolean): number {
    const key = keepMeLoggedIn
      ? 'jwt.refreshTtlExtended'
      : 'jwt.refreshTtlDefault';
    return ms(this.config.get<string>(key) as string);
  }

  async create(
    userId: string,
    keepMeLoggedIn: boolean,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<CreateSessionResult> {
    const refreshToken = generateOpaqueToken();
    const expiresAt = new Date(Date.now() + this.refreshTtlMs(keepMeLoggedIn));
    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.hashToken(refreshToken),
        expiresAt,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
      },
    });
    return {
      refreshToken,
      session: { id: session.id, expiresAt: session.expiresAt },
    };
  }

  /**
   * Rotates the refresh token in place. If the presented token matches the
   * *previous* generation (i.e. it was already rotated once), that's a replay
   * of a stale token — treat it as a theft signal and revoke the session.
   */
  async rotate(
    presentedToken: string,
    meta: { userAgent?: string; ipAddress?: string },
  ): Promise<{ userId: string; refreshToken: string }> {
    const presentedHash = this.hashToken(presentedToken);

    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: presentedHash, revokedAt: null },
    });

    if (session) {
      if (session.expiresAt < new Date()) {
        throw new AppException(
          'SESSION_EXPIRED',
          'Your session has expired. Please log in again.',
          HttpStatus.UNAUTHORIZED,
        );
      }
      const newToken = generateOpaqueToken();
      await this.prisma.session.update({
        where: { id: session.id },
        data: {
          previousTokenHash: session.refreshTokenHash,
          refreshTokenHash: this.hashToken(newToken),
          userAgent: meta.userAgent ?? session.userAgent,
          ipAddress: meta.ipAddress ?? session.ipAddress,
        },
      });
      return { userId: session.userId, refreshToken: newToken };
    }

    const staleSession = await this.prisma.session.findFirst({
      where: { previousTokenHash: presentedHash, revokedAt: null },
    });
    if (staleSession) {
      await this.prisma.session.update({
        where: { id: staleSession.id },
        data: { revokedAt: new Date() },
      });
      throw new AppException(
        'REFRESH_TOKEN_REUSED',
        'This session was terminated for your security. Please log in again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    throw new AppException(
      'INVALID_REFRESH_TOKEN',
      'Invalid or expired session.',
      HttpStatus.UNAUTHORIZED,
    );
  }

  async revoke(presentedToken: string): Promise<void> {
    const hash = this.hashToken(presentedToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: hash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
