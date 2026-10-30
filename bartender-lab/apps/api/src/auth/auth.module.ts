import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { APP_CONFIG, type AppConfig } from '../config/env.validation';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PasswordHasher } from './password-hasher';
import { JWT_ISSUER, TokenService } from './token.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        secret: config.jwtAccessSecret,
        signOptions: {
          algorithm: 'HS256',
          expiresIn: config.jwtAccessTtlSeconds,
          issuer: JWT_ISSUER,
          audience: JWT_ISSUER,
        },
        verifyOptions: { algorithms: ['HS256'], issuer: JWT_ISSUER, audience: JWT_ISSUER },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TokenService,
    JwtAuthGuard,
    {
      provide: PasswordHasher,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new PasswordHasher(config.passwordHashCost),
    },
  ],
  exports: [TokenService, JwtAuthGuard],
})
export class AuthModule {}
