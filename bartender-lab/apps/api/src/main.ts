import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { AppModule } from './app.module';
import { API_PREFIX, configureApp, SWAGGER_PATH } from './app.setup';
import { APP_CONFIG, type AppConfig } from './config/env.validation';

async function bootstrap(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get<AppConfig>(APP_CONFIG);
  configureApp(app, config);
  await app.listen(config.port);

  const logger = new Logger('Bootstrap');
  logger.log(`API listening on port ${config.port} (prefix /${API_PREFIX})`);
  if (config.swaggerEnabled) logger.log(`Swagger UI at /${SWAGGER_PATH}`);
}

void bootstrap();
