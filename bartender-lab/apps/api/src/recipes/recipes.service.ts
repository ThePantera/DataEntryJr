import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { matchRecipes, type MatchSubstitution } from '@bartender-lab/shared';
import type { Prisma } from '@prisma/client';
import type { AuthenticatedUser } from '../common/authenticated-user';
import { paginationArgs, type Paginated } from '../common/dto/pagination.dto';
import { toNumber } from '../common/utils/decimal';
import { PrismaService } from '../prisma/prisma.service';
import type {
  ListRecipesQueryDto,
  MatchRecipesDto,
  MatchResponseDto,
  RecipeCategoryDto,
  RecipeDetailDto,
  RecipeIngredientDto,
  RecipeStepDto,
  RecipeSummaryDto,
} from './dto/recipes.dto';
import {
  DETAIL_INCLUDE,
  SUMMARY_INCLUDE,
  toRecipeDetail,
  toRecipeIngredients,
  toRecipeSteps,
  toRecipeSummary,
  type RecipeDetailRow,
} from './recipe.mapper';

export const MATCH_ENGINE_VERSION = 'DETERMINISTIC_V1';

export function isEditor(user?: AuthenticatedUser): boolean {
  return user?.role === 'EDITOR' || user?.role === 'ADMIN';
}

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    query: ListRecipesQueryDto,
    user?: AuthenticatedUser,
  ): Promise<Paginated<RecipeSummaryDto>> {
    const status = query.status ?? 'PUBLISHED';
    if (status !== 'PUBLISHED' && !isEditor(user)) {
      throw new ForbiddenException('Only editors can list unpublished recipes');
    }
    const search = query.search
      ? { contains: query.search, mode: 'insensitive' as const }
      : undefined;
    const where: Prisma.RecipeWhereInput = {
      verificationStatus: status,
      difficulty: query.difficulty,
      origin: query.origin,
      ingredients: query.ingredientId ? { some: { ingredientId: query.ingredientId } } : undefined,
      categories: query.categoryId ? { some: { categoryId: query.categoryId } } : undefined,
      OR: search
        ? [{ name: search }, { ingredients: { some: { ingredient: { name: search } } } }]
        : undefined,
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.recipe.findMany({
        where,
        include: SUMMARY_INCLUDE,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        ...paginationArgs(query),
      }),
      this.prisma.recipe.count({ where }),
    ]);
    return { items: rows.map(toRecipeSummary), page: query.page, pageSize: query.pageSize, total };
  }

  async categories(): Promise<RecipeCategoryDto[]> {
    const rows = await this.prisma.category.findMany({
      where: { kind: 'RECIPE' },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { recipes: { where: { recipe: { verificationStatus: 'PUBLISHED' } } } } },
      },
    });
    return rows.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      publishedRecipeCount: c._count.recipes,
    }));
  }

  async get(id: string, user?: AuthenticatedUser, servings?: number): Promise<RecipeDetailDto> {
    return toRecipeDetail(await this.findVisible(id, user), servings);
  }

  async ingredients(
    id: string,
    user?: AuthenticatedUser,
    servings?: number,
  ): Promise<RecipeIngredientDto[]> {
    return toRecipeIngredients(await this.findVisible(id, user), servings);
  }

  async steps(id: string, user?: AuthenticatedUser): Promise<RecipeStepDto[]> {
    return toRecipeSteps(await this.findVisible(id, user));
  }

  /** Unpublished recipes do not exist for the public: 404 rather than 403. */
  async findVisible(id: string, user?: AuthenticatedUser): Promise<RecipeDetailRow> {
    const row = await this.prisma.recipe.findUnique({ where: { id }, include: DETAIL_INCLUDE });
    if (!row || (row.verificationStatus !== 'PUBLISHED' && !isEditor(user))) {
      throw new NotFoundException('Recipe not found');
    }
    return row;
  }

  /**
   * Runs the deterministic matching engine over every published recipe.
   * Inventory items with quantity 0 count as "not available"; a null quantity means "have some".
   */
  async match(dto: MatchRecipesDto, user?: AuthenticatedUser): Promise<MatchResponseDto> {
    const available = new Set(dto.ingredientIds ?? []);
    if (dto.useInventory) {
      if (!user) throw new UnauthorizedException('useInventory requires authentication');
      for (const id of await this.availableInventoryIds(user.id)) available.add(id);
    }

    const [recipes, substitutionRows] = await Promise.all([
      this.prisma.recipe.findMany({
        where: { verificationStatus: 'PUBLISHED' },
        select: {
          id: true,
          name: true,
          slug: true,
          origin: true,
          ingredients: { select: { ingredientId: true, optional: true } },
        },
      }),
      this.prisma.ingredientSubstitution.findMany({ where: { approved: true } }),
    ]);
    const substitutions: MatchSubstitution[] = substitutionRows.map((s) => ({
      ingredientId: s.ingredientId,
      substituteId: s.substituteId,
      recipeId: s.recipeId,
      ratio: toNumber(s.ratio) ?? 1,
    }));

    const results = matchRecipes(recipes, available, substitutions, {
      includeIncomplete: dto.includeIncomplete ?? true,
      maxMissing: dto.maxMissing,
    }).slice(0, dto.limit ?? 50);

    const referenced = new Set<string>();
    for (const r of results) {
      r.missingRequired.forEach((id) => referenced.add(id));
      r.missingOptional.forEach((id) => referenced.add(id));
      r.substitutions.forEach((s) => referenced.add(s.ingredientId).add(s.substituteId));
    }
    const names = new Map(
      (
        await this.prisma.ingredient.findMany({
          where: { id: { in: [...referenced] } },
          select: { id: true, name: true },
        })
      ).map((i) => [i.id, i.name]),
    );
    const notes = new Map(
      substitutionRows.map((s) => [
        `${s.ingredientId}:${s.substituteId}:${s.recipeId ?? '*'}`,
        s.notes,
      ]),
    );
    const recipeById = new Map(recipes.map((r) => [r.id, r]));
    const ref = (id: string) => ({ id, name: names.get(id) ?? '' });

    return {
      engine: MATCH_ENGINE_VERSION,
      evaluatedRecipes: recipes.length,
      results: results.map((r) => {
        const recipe = recipeById.get(r.recipeId)!;
        return {
          recipeId: r.recipeId,
          recipeName: r.recipeName,
          recipeSlug: recipe.slug,
          origin: recipe.origin,
          isOfficialClassic: recipe.origin === 'CLASSIC',
          classification: r.classification,
          requiredCount: r.requiredCount,
          availableRequiredCount: r.availableRequired.length,
          missingRequired: r.missingRequired.map(ref),
          missingOptional: r.missingOptional.map(ref),
          substitutions: r.substitutions.map((s) => ({
            ingredientId: s.ingredientId,
            ingredientName: names.get(s.ingredientId) ?? '',
            substituteId: s.substituteId,
            substituteName: names.get(s.substituteId) ?? '',
            ratio: s.ratio,
            notes:
              notes.get(`${s.ingredientId}:${s.substituteId}:${r.recipeId}`) ??
              notes.get(`${s.ingredientId}:${s.substituteId}:*`) ??
              null,
          })),
        };
      }),
    };
  }

  private async availableInventoryIds(userId: string): Promise<string[]> {
    const items = await this.prisma.inventoryItem.findMany({
      where: { userId, deletedAt: null, OR: [{ quantity: null }, { quantity: { gt: 0 } }] },
      select: { ingredientId: true },
    });
    return items.map((i) => i.ingredientId);
  }
}
