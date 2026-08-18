import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { join } from 'path';
import { AppModule } from './app.module';

function setupSwagger(app: NestExpressApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Petzi API')
    .setDescription(
      'Backend API for Petzi — phone OTP registration/login, Google OAuth, and pet management.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'JWT access token from login or registration',
      },
      'JWT',
    )
    .addTag('Health', 'Service health check')
    .addTag('Auth', 'Registration, login, Google OAuth, and profile')
    .addTag(
      'Pets',
      'Pet registration — draft, update, vaccines, documents, submit',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Petzi API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
    },
  });
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const swaggerEnabled = configService.get<boolean>('swagger.enabled') ?? false;

  app.use(swaggerEnabled ? helmet({ contentSecurityPolicy: false }) : helmet());
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.enableCors({
    origin: configService.get<string[]>('cors.origins') ?? [],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useStaticAssets(join(__dirname, '..', 'uploads', 'profile-pictures'), {
    prefix: '/uploads/profile-pictures',
  });

  if (swaggerEnabled) {
    setupSwagger(app);
  }

  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`Petzi API running on http://localhost:${port}/api/v1`);
  if (swaggerEnabled) {
    logger.log(`Swagger docs at http://localhost:${port}/api/docs`);
  }
}

void bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');
  logger.error(
    'Application failed to start',
    error instanceof Error ? error.stack : String(error),
  );
  process.exitCode = 1;
});
