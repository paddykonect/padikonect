import { CanActivate, Injectable } from '@nestjs/common';

/**
 * Stub — always allows. Real logic (an IdentityVerification status check)
 * lands in the Premium+Verification phase; this guard's position in the
 * `POST /events` chain does not change, only this method's body does.
 */
@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(): boolean {
    return true;
  }
}
