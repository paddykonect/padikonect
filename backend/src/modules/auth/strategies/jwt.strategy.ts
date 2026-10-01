import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthenticatedUser } from '../../../common/decorators/current-user.decorator';

export interface AccessTokenPayload {
  sub: string;
  role: 'MEMBER' | 'ADMIN';
  status: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.accessSecret') as string,
    });
  }

  // Runs only after signature+expiry are already verified by passport-jwt.
  validate(payload: AccessTokenPayload): AuthenticatedUser {
    return {
      id: payload.sub,
      role: payload.role,
      status: payload.status,
    };
  }
}
