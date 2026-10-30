import { Module } from '@nestjs/common';
import { RecipesModule } from '../recipes/recipes.module';
import { TechniquesModule } from '../techniques/techniques.module';
import { AiAssistantController } from './ai-assistant.controller';
import { AiAssistantService } from './ai-assistant.service';

@Module({
  imports: [RecipesModule, TechniquesModule],
  controllers: [AiAssistantController],
  providers: [AiAssistantService],
})
export class AiAssistantModule {}
