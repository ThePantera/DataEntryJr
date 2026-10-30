import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { OpenAPIObject } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { buildOpenApiDocument, configureApp } from './app.setup';
import { APP_CONFIG, type AppConfig } from './config/env.validation';

/**
 * Builds the OpenAPI document without connecting to the database
 * (providers are instantiated, but lifecycle hooks such as $connect are not run).
 */
export async function generateOpenApiDocument(): Promise<OpenAPIObject> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    configureApp(app, { ...app.get<AppConfig>(APP_CONFIG), swaggerEnabled: false });
    return buildOpenApiDocument(app);
  } finally {
    await app.close();
  }
}
