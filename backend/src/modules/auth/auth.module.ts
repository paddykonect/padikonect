import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MailerModule } from '../../integrations/mailer/mailer.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LockoutService } from './lockout.service';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

@Module({
  imports: [
    PassportModule,
    MailerModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.accessSecret'),
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    OtpService,
    SessionService,
    TokenService,
    LockoutService,
    JwtStrategy,
  ],
  exports: [TokenService, SessionService],
})
export class AuthModule {}
