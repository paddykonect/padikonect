import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccountStatus } from '@prisma/client';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  WebAuthnCredential,
} from '@simplewebauthn/server';
import Redis from 'ioredis';
import { AppException } from '../../common/exceptions/app.exception';
import { generateOpaqueToken } from '../../common/utils/crypto.util';
import { REDIS_CLIENT } from '../../database/redis.module';
import { PrismaService } from '../../database/prisma.service';
import { PublicUser, RequestMeta } from '../auth/auth.service';
import { SessionService } from '../auth/session.service';
import { TokenService } from '../auth/token.service';

const REGISTRATION_CHALLENGE_TTL_SECONDS = 120;
const AUTHENTICATION_FLOW_TTL_SECONDS = 120;

interface AuthFlowState {
  userId: string;
  challenge: string;
}

export interface WebauthnLoginResult {
  accessToken: string;
  refreshToken: string;
  refreshTokenExpiresAt: Date;
  user: PublicUser;
}

const VERIFICATION_FAILED = () =>
  new AppException(
    'WEBAUTHN_VERIFICATION_FAILED',
    'Could not verify this device. Please try again.',
    HttpStatus.BAD_REQUEST,
  );

const CHALLENGE_EXPIRED = () =>
  new AppException(
    'WEBAUTHN_CHALLENGE_EXPIRED',
    'This request has expired. Please try again.',
    HttpStatus.BAD_REQUEST,
  );

@Injectable()
export class WebauthnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly sessions: SessionService,
    private readonly tokens: TokenService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  private get rpName(): string {
    return this.config.get<string>('webauthn.rpName') as string;
  }

  private get rpId(): string {
    return this.config.get<string>('webauthn.rpId') as string;
  }

  private get origin(): string {
    return this.config.get<string>('webauthn.origin') as string;
  }

  async getRegistrationOptions(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
    });
    const existing = await this.prisma.webauthnCredential.findMany({
      where: { userId },
    });

    const options = await generateRegistrationOptions({
      rpName: this.rpName,
      rpID: this.rpId,
      userID: new TextEncoder().encode(user.id),
      userName: user.email,
      userDisplayName: user.fullName,
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credentialId,
        transports: c.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    await this.redis.set(
      `webauthn:reg:${userId}`,
      options.challenge,
      'EX',
      REGISTRATION_CHALLENGE_TTL_SECONDS,
    );
    return options;
  }

  async verifyRegistration(
    userId: string,
    response: RegistrationResponseJSON,
  ): Promise<void> {
    const expectedChallenge = await this.redis.get(`webauthn:reg:${userId}`);
    if (!expectedChallenge) throw CHALLENGE_EXPIRED();

    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
      });
    } catch {
      throw VERIFICATION_FAILED();
    }

    if (!verification.verified || !verification.registrationInfo) {
      throw VERIFICATION_FAILED();
    }

    const { credential, credentialDeviceType, credentialBackedUp } =
      verification.registrationInfo;

    await this.prisma.webauthnCredential.create({
      data: {
        userId,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: BigInt(credential.counter),
        transports: credential.transports ?? [],
        deviceType: credentialDeviceType,
        backedUp: credentialBackedUp,
      },
    });

    await this.redis.del(`webauthn:reg:${userId}`);
  }

  async getAuthenticationOptions(identifier: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ phone: identifier }, { email: identifier }] },
    });
    const credentials = user
      ? await this.prisma.webauthnCredential.findMany({
          where: { userId: user.id },
        })
      : [];

    if (!user || credentials.length === 0) {
      throw new AppException(
        'WEBAUTHN_NOT_ENROLLED',
        'Biometric login is not set up for this account.',
        HttpStatus.NOT_FOUND,
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: this.rpId,
      userVerification: 'preferred',
      allowCredentials: credentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports,
      })),
    });

    const flowId = generateOpaqueToken(24);
    const state: AuthFlowState = {
      userId: user.id,
      challenge: options.challenge,
    };
    await this.redis.set(
      `webauthn:authflow:${flowId}`,
      JSON.stringify(state),
      'EX',
      AUTHENTICATION_FLOW_TTL_SECONDS,
    );

    return { flowId, options };
  }

  async verifyAuthentication(
    flowId: string,
    response: AuthenticationResponseJSON,
    meta: RequestMeta,
  ): Promise<WebauthnLoginResult> {
    const raw = await this.redis.get(`webauthn:authflow:${flowId}`);
    if (!raw) throw CHALLENGE_EXPIRED();
    const { userId, challenge } = JSON.parse(raw) as AuthFlowState;

    const stored = await this.prisma.webauthnCredential.findUnique({
      where: { credentialId: response.id },
    });
    if (!stored || stored.userId !== userId) throw VERIFICATION_FAILED();

    const credential: WebAuthnCredential = {
      id: stored.credentialId,
      publicKey: stored.publicKey,
      counter: Number(stored.counter),
      transports: stored.transports,
    };

    let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: this.origin,
        expectedRPID: this.rpId,
        credential,
      });
    } catch {
      throw VERIFICATION_FAILED();
    }

    if (!verification.verified) throw VERIFICATION_FAILED();

    await this.prisma.webauthnCredential.update({
      where: { id: stored.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });
    await this.redis.del(`webauthn:authflow:${flowId}`);

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
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.tokens.signAccessToken({
      sub: user.id,
      role: user.role,
      status: user.status,
    });
    const { refreshToken, session } = await this.sessions.create(
      user.id,
      false,
      meta,
    );

    return {
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: session.expiresAt,
      user: {
        id: user.id,
        fullName: user.fullName,
        phone: user.phone,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    };
  }
}
