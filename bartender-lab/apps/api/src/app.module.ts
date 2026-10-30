import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AiAssistantModule } from './ai-assistant/ai-assistant.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { AUTH_RATE_LIMIT_KEY } from './common/decorators/auth-rate-limit.decorator';
import { RolesGuard } from './common/guards/roles.guard';
import { ConfigModule } from './config/config.module';
import { APP_CONFIG, type AppConfig } from './config/env.validation';
import { CategoriesModule } from './categories/categories.module';
import { EquipmentModule } from './equipment/equipment.module';
import { FavoritesModule } from './favorites/favorites.module';
import { GlasswareModule } from './glassware/glassware.module';
import { HealthController } from './health/health.controller';
import { IngredientsModule } from './ingredients/ingredients.module';
import { InventoryModule } from './inventory/inventory.module';
import { ManifestModule } from './manifest/manifest.module';
import { PrismaModule } from './prisma/prisma.module';
import { RecipesModule } from './recipes/recipes.module';
import { ShoppingListsModule } from './shopping-lists/shopping-lists.module';
import { SyncModule } from './sync/sync.module';
import { TechniquesModule } from './techniques/techniques.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    ManifestModule,
    ThrottlerModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          { name: 'default', ttl: config.throttleTtlSeconds * 1000, limit: config.throttleLimit },
          {
            name: 'auth',
            ttl: config.throttleTtlSeconds * 1000,
            limit: config.authThrottleLimit,
            skipIf: (context) => !Reflect.getMetadata(AUTH_RATE_LIMIT_KEY, context.getClass()),
          },
        ],
      }),
    }),
    AuthModule,
    UsersModule,
    CategoriesModule,
    IngredientsModule,
    GlasswareModule,
    EquipmentModule,
    TechniquesModule,
    RecipesModule,
    InventoryModule,
    FavoritesModule,
    ShoppingListsModule,
    SyncModule,
    AiAssistantModule,
  ],
  controllers: [HealthController],
  providers: [
    // Order matters: rate limiting first, then authentication, then role checks.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
