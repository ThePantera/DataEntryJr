import type { Favorite } from '@prisma/client';
import type { FavoriteDto } from './dto/favorites.dto';

export function toFavoriteDto(row: Favorite): FavoriteDto {
  return {
    id: row.id,
    recipeId: row.recipeId,
    version: row.version,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt,
  };
}
