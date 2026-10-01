import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AppException } from '../../common/exceptions/app.exception';
import { AccessTokenPayload } from './strategies/jwt.strategy';

export type PendingTokenPurpose = 'SIGNUP_VERIFICATION' | 'PASSWORD_RESET';

interface PendingTokenPayload {
  sub: string;
  purpose: PendingTokenPurpose;
  type: 'otp_pending';
}

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      // Cast needed: our config value is a validated duration string (e.g. "15m"),
      // but @nestjs/jwt types expiresIn against a branded literal-union type
      // that a plain `string` can never structurally satisfy.
      expiresIn: this.config.get<string>('jwt.accessTtl') as unknown as number,
    });
  }

  // Short-lived, references the userId without exposing it directly to the
  // client — used for the signup-OTP and forgot-password flows so /verify and
  // /resend never need a raw userId, which would make account enumeration trivial.
  signPendingToken(userId: string, purpose: PendingTokenPurpose): string {
    const payload: PendingTokenPayload = {
      sub: userId,
      purpose,
      type: 'otp_pending',
    };
    return this.jwt.sign(payload, {
      secret: this.config.get<string>('jwt.accessSecret'),
      expiresIn: '15m',
    });
  }

  verifyPendingToken(
    token: string,
    expectedPurpose: PendingTokenPurpose,
  ): string {
    let payload: PendingTokenPayload;
    try {
      payload = this.jwt.verify<PendingTokenPayload>(token, {
        secret: this.config.get<string>('jwt.accessSecret'),
      });
    } catch {
      throw new AppException(
        'INVALID_PENDING_TOKEN',
        'This request has expired. Please start again.',
        HttpStatus.BAD_REQUEST,
      );
    }
    if (payload.type !== 'otp_pending' || payload.purpose !== expectedPurpose) {
      throw new AppException(
        'INVALID_PENDING_TOKEN',
        'This request has expired. Please start again.',
        HttpStatus.BAD_REQUEST,
      );
    }
    return payload.sub;
  }
}
