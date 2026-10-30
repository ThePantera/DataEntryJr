import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SUMMARY_INCLUDE, toRecipeSummary } from '../recipes/recipe.mapper';
import type { FavoriteDto, FavoriteWithRecipeDto } from './dto/favorites.dto';
import { toFavoriteDto } from './favorite.mapper';

/** Favorites behave as a set: adding or removing twice has the same effect as once. */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<FavoriteWithRecipeDto[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { userId, deletedAt: null },
      include: { recipe: { include: SUMMARY_INCLUDE } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
    return rows.map((row) => {
      const available = row.recipe.verificationStatus === 'PUBLISHED';
      return {
        ...toFavoriteDto(row),
        recipeAvailable: available,
        recipe: available ? toRecipeSummary(row.recipe) : null,
      };
    });
  }

  async add(userId: string, recipeId: string): Promise<FavoriteDto> {
    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.recipe.findUnique({
        where: { id: recipeId },
        select: { verificationStatus: true },
      });
      if (!recipe || recipe.verificationStatus !== 'PUBLISHED')
        throw new NotFoundException('Recipe not found');

      const existing = await tx.favorite.findUnique({
        where: { userId_recipeId: { userId, recipeId } },
      });
      if (existing && !existing.deletedAt) return toFavoriteDto(existing);
      if (existing) {
        return toFavoriteDto(
          await tx.favorite.update({
            where: { id: existing.id },
            data: { deletedAt: null, version: { increment: 1 } },
          }),
        );
      }
      return toFavoriteDto(await tx.favorite.create({ data: { userId, recipeId } }));
    });
  }

  async remove(userId: string, recipeId: string): Promise<void> {
    await this.prisma.favorite.updateMany({
      where: { userId, recipeId, deletedAt: null },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
  }
}
