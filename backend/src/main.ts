import * as Sentry from '@sentry/node';
import { Logger, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);

  const sentryDsn = config.get<string>('sentry.dsn');
  if (sentryDsn) {
    Sentry.init({
      dsn: sentryDsn,
      environment: config.get<string>('app.nodeEnv'),
      tracesSampleRate: 0.2,
      // Sentry breadcrumbs must never capture request bodies — those can hold
      // passwords/OTPs/tokens. beforeSend strips them defensively.
      beforeSend(event) {
        if (event.request) {
          delete event.request.data;
        }
        return event;
      },
    });
  }

  const requestIdMiddleware = new RequestIdMiddleware();
  app.use(
    (
      req: Parameters<typeof requestIdMiddleware.use>[0],
      res: Parameters<typeof requestIdMiddleware.use>[1],
      next: Parameters<typeof requestIdMiddleware.use>[2],
    ) => requestIdMiddleware.use(req, res, next),
  );
  app.use(helmet());
  app.use(compression());
  app.use(cookieParser());

  app.enableCors({
    origin: config.get<string>('app.corsOrigin'),
    credentials: true,
  });

  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.setGlobalPrefix(config.get<string>('app.apiPrefix') ?? 'api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Paddykonect API')
    .setDescription('Paddykonect backend API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  app.enableShutdownHooks();

  const port = config.get<number>('app.port') ?? 3000;
  await app.listen(port);
  Logger.log(`Paddykonect API listening on port ${port}`, 'Bootstrap');
}

void bootstrap();
