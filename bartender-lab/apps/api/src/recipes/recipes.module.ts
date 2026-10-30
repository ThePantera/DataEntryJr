import { Module } from '@nestjs/common';
import { RecipeAdminService } from './recipe-admin.service';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { SubstitutionsController } from './substitutions.controller';

@Module({
  controllers: [RecipesController, SubstitutionsController],
  providers: [RecipesService, RecipeAdminService],
  exports: [RecipesService],
})
export class RecipesModule {}
