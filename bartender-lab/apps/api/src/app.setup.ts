import { INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { PrismaExceptionFilter } from './common/filters/prisma-exception.filter';
import type { AppConfig } from './config/env.validation';

export const API_PREFIX = 'api/v1';
export const SWAGGER_PATH = 'api/docs';

export function buildOpenApiDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('BARTENDER LAB API')
    .setDescription(
      'API REST de BARTENDER LAB. El contenido publicado (recetas, técnicas, ingredientes) es público; ' +
        'los datos personales requieren un access token Bearer.',
    )
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  return SwaggerModule.createDocument(app, config);
}

/** Shared by main.ts and the e2e tests so both run exactly the same HTTP pipeline. */
export function configureApp(app: NestExpressApplication, config: AppConfig): void {
  app.setGlobalPrefix(API_PREFIX);
  app.use(helmet());
  if (config.trustProxy) app.set('trust proxy', 1);
  if (config.corsOrigins.length > 0) app.enableCors({ origin: config.corsOrigins });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableShutdownHooks();

  if (config.swaggerEnabled) {
    SwaggerModule.setup(SWAGGER_PATH, app, buildOpenApiDocument(app));
  }
}
