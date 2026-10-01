import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { setRefreshCookie } from '../auth/refresh-cookie.util';
import { AuthenticationOptionsDto } from './dto/authentication-options.dto';
import { AuthenticationVerifyDto } from './dto/authentication-verify.dto';
import { RegistrationVerifyDto } from './dto/registration-verify.dto';
import { WebauthnService } from './webauthn.service';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('webauthn')
@Controller('auth/webauthn')
export class WebauthnController {
  constructor(
    private readonly webauthn: WebauthnService,
    private readonly config: ConfigService,
  ) {}

  @ApiBearerAuth()
  @Post('registration/options')
  @HttpCode(HttpStatus.OK)
  getRegistrationOptions(@CurrentUser() user: AuthenticatedUser) {
    return this.webauthn.getRegistrationOptions(user.id);
  }

  @ApiBearerAuth()
  @Post('registration/verify')
  @HttpCode(HttpStatus.OK)
  async verifyRegistration(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RegistrationVerifyDto,
  ) {
    await this.webauthn.verifyRegistration(user.id, dto.response);
    return { message: 'Biometric login enabled.' };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('authentication/options')
  @HttpCode(HttpStatus.OK)
  getAuthenticationOptions(@Body() dto: AuthenticationOptionsDto) {
    return this.webauthn.getAuthenticationOptions(dto.identifier);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('authentication/verify')
  @HttpCode(HttpStatus.OK)
  async verifyAuthentication(
    @Body() dto: AuthenticationVerifyDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.webauthn.verifyAuthentication(
      dto.flowId,
      dto.response,
      { userAgent: req.headers['user-agent'], ipAddress: req.ip },
    );
    setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
      this.config.get('app.nodeEnv') as string,
    );
    return result;
  }
}
