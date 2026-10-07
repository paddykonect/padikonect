import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, TokenPayload } from 'google-auth-library';
import { AppException } from '../../common/exceptions/app.exception';

export interface GoogleIdentity {
  googleId: string;
  email: string;
  name: string | null;
}

// Verifies Google Identity Services ID tokens (signature, expiry, issuer and
// audience) — the frontend never sends us anything we trust without this.
@Injectable()
export class GoogleAuthService {
  private readonly clientId?: string;
  private readonly client = new OAuth2Client();

  constructor(config: ConfigService) {
    this.clientId = config.get<string>('googleAuth.clientId');
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.clientId) {
      throw new AppException(
        'GOOGLE_SIGN_IN_DISABLED',
        'Google sign-in is not available right now.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    let payload: TokenPayload | undefined;
    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience: this.clientId,
      });
      payload = ticket.getPayload();
    } catch {
      payload = undefined;
    }

    if (!payload?.sub || !payload.email) {
      throw new AppException(
        'GOOGLE_TOKEN_INVALID',
        'Google sign-in failed. Please try again.',
        HttpStatus.UNAUTHORIZED,
      );
    }
    // Only a Google-verified email may be matched to an existing account.
    if (!payload.email_verified) {
      throw new AppException(
        'GOOGLE_EMAIL_UNVERIFIED',
        'Your Google account email is not verified.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      name: payload.name ?? null,
    };
  }
}
