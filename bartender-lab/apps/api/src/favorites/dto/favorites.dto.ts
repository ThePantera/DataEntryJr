import { ApiProperty } from '@nestjs/swagger';
import { SyncedRecordDto } from '../../common/dto/user-data.dto';
import { RecipeSummaryDto } from '../../recipes/dto/recipes.dto';

export class FavoriteDto extends SyncedRecordDto {
  @ApiProperty({ format: 'uuid' }) recipeId: string;
}

export class FavoriteWithRecipeDto extends FavoriteDto {
  @ApiProperty({ description: 'false si la receta dejó de estar publicada.' })
  recipeAvailable: boolean;
  @ApiProperty({ type: RecipeSummaryDto, nullable: true }) recipe: RecipeSummaryDto | null;
}
