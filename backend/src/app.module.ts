import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import {
  appConfig,
  cloudinaryConfig,
  databaseConfig,
  googleMapsConfig,
  jwtConfig,
  mailConfig,
  otpConfig,
  redisConfig,
  sentryConfig,
  webauthnConfig,
} from './config/configuration';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './database/prisma.module';
import { RedisModule } from './database/redis.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseTransformInterceptor } from './common/interceptors/response-transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ActiveAccountGuard } from './common/guards/active-account.guard';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { FeedModule } from './modules/feed/feed.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { EventsModule } from './modules/events/events.module';
import { RsvpModule } from './modules/rsvp/rsvp.module';
import { WebauthnModule } from './modules/webauthn/webauthn.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        sentryConfig,
        jwtConfig,
        otpConfig,
        mailConfig,
        cloudinaryConfig,
        googleMapsConfig,
        webauthnConfig,
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
      // Disabled only under automated tests (NODE_ENV=test, set by CI and by
      // e2e test runs) — never in development/staging/production. Rate
      // limiting is a real security control (brute-force/signup-abuse
      // prevention); this skip exists so a single e2e spec file creating
      // many users in quick succession doesn't trip it and produce flaky,
      // meaningless 429s that have nothing to do with the behavior under test.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    ProfilesModule,
    FeedModule,
    NotificationsModule,
    EventsModule,
    RsvpModule,
    WebauthnModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ActiveAccountGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor },
  ],
})
export class AppModule {}
