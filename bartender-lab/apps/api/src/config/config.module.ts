import { Global, Module } from '@nestjs/common';
import { APP_CONFIG, validateEnv } from './env.validation';

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => validateEnv(process.env) }],
  exports: [APP_CONFIG],
})
export class ConfigModule {}
