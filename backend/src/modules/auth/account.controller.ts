import {
  Body,
  Controller,
  Delete,
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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { AccountService } from './account.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import {
  RequestContactChangeDto,
  VerifyContactChangeDto,
} from './dto/contact-change.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { clearRefreshCookie, setRefreshCookie } from './refresh-cookie.util';

const SENSITIVE_THROTTLE = { default: { limit: 10, ttl: 60_000 } };

@ApiTags('account')
@ApiBearerAuth()
@Controller('account')
export class AccountController {
  constructor(
    private readonly account: AccountService,
    private readonly config: ConfigService,
  ) {}

  @Post('password')
  @Throttle(SENSITIVE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.account.changePassword(user.id, dto, {
      userAgent: req.headers['user-agent'],
      ipAddress: req.ip,
    });
    setRefreshCookie(
      res,
      result.refreshToken,
      result.refreshTokenExpiresAt,
      this.config.get('app.nodeEnv') as string,
    );
    return { accessToken: result.accessToken };
  }

  @Post('contact-change')
  @Throttle(SENSITIVE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  requestContactChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RequestContactChangeDto,
  ) {
    return this.account.requestContactChange(user.id, dto);
  }

  @Post('contact-change/resend')
  @Throttle(SENSITIVE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  resendContactChange(@CurrentUser() user: AuthenticatedUser) {
    return this.account.resendContactChange(user.id);
  }

  @Post('contact-change/verify')
  @Throttle(SENSITIVE_THROTTLE)
  @HttpCode(HttpStatus.OK)
  verifyContactChange(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyContactChangeDto,
  ) {
    return this.account.verifyContactChange(user.id, dto.code);
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    // Validated for the "I understand" confirmation.
    @Body() _dto: DeleteAccountDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.account.deleteAccount(user.id);
    clearRefreshCookie(res, this.config.get('app.nodeEnv') as string);
    return { message: 'Your account has been deleted.' };
  }
}
