import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AuthService, RequestMeta } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleSignInDto } from './dto/google-sign-in.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { ResendOtpDto } from './dto/resend-otp.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import {
  clearRefreshCookie,
  REFRESH_COOKIE_NAME,
  setRefreshCookie,
} from './refresh-cookie.util';

const AUTH_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

function requestMeta(req: Request): RequestMeta {
  return {
    userAgent: req.headers['user-agent'],
    ipAddress: req.ip,
  };
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('signup')
  async signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('otp/resend')
  @HttpCode(HttpStatus.OK)
  async resendOtp(@Body() dto: ResendOtpDto) {
    await this.authService.resendSignupOtp(dto);
    return { message: 'A new code has been sent.' };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  async verifyOtp(
    @Body() dto: VerifyOtpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.verifySignupOtp(
      dto,
      requestMeta(req),
    );
    setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
      this.config.get('app.nodeEnv') as string,
    );
    return result;
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(dto, requestMeta(req));
    if ('accessToken' in result) {
      setRefreshCookie(
        res,
        result.refreshToken,
        result.refreshTokenExpiresAt,
        this.config.get('app.nodeEnv') as string,
      );
    }
    return result;
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async google(
    @Body() dto: GoogleSignInDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.googleSignIn(dto, requestMeta(req));
    setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
      this.config.get('app.nodeEnv') as string,
    );
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented =
      dto.refreshToken ??
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);
    if (!presented) {
      throw new UnauthorizedException('No refresh token provided');
    }
    const result = await this.authService.refresh(presented, requestMeta(req));
    setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
      this.config.get('app.nodeEnv') as string,
    );
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body() dto: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const presented =
      dto.refreshToken ??
      (req.cookies?.[REFRESH_COOKIE_NAME] as string | undefined);
    if (presented) {
      await this.authService.logout(presented);
    }
    clearRefreshCookie(res, this.config.get('app.nodeEnv') as string);
    return { message: 'Logged out.' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logoutAll(user.id);
    clearRefreshCookie(res, this.config.get('app.nodeEnv') as string);
    return { message: 'Logged out of all devices.' };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('forgot-password/resend')
  @HttpCode(HttpStatus.OK)
  async resendForgotPasswordOtp(@Body() dto: ResendOtpDto) {
    await this.authService.resendPasswordResetOtp(dto);
    return { message: 'A new code has been sent.' };
  }

  @Public()
  @Throttle(AUTH_THROTTLE)
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto);
    return { message: 'Password updated. Please log in.' };
  }
}
