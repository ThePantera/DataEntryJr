import { scaleIngredients } from '@bartender-lab/shared';
import type { Allergen, Prisma } from '@prisma/client';
import { toNumber } from '../common/utils/decimal';
import type {
  RecipeDetailDto,
  RecipeIngredientDto,
  RecipeStepDto,
  RecipeSummaryDto,
} from './dto/recipes.dto';

export const SUMMARY_INCLUDE = {
  glassware: { select: { id: true, name: true, capacityMl: true } },
  technique: { select: { id: true, name: true } },
} as const satisfies Prisma.RecipeInclude;

export const DETAIL_INCLUDE = {
  ...SUMMARY_INCLUDE,
  ingredients: {
    include: { ingredient: { select: { id: true, name: true, allergens: true } } },
    orderBy: { position: 'asc' },
  },
  steps: { orderBy: { stepNumber: 'asc' } },
  categories: { include: { category: { select: { id: true, name: true } } } },
} as const satisfies Prisma.RecipeInclude;

export type RecipeSummaryRow = Prisma.RecipeGetPayload<{ include: typeof SUMMARY_INCLUDE }>;
export type RecipeDetailRow = Prisma.RecipeGetPayload<{ include: typeof DETAIL_INCLUDE }>;

export function toRecipeSummary(row: RecipeSummaryRow): RecipeSummaryDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    difficulty: row.difficulty,
    preparationTimeSeconds: row.preparationTimeSeconds,
    glassware: row.glassware,
    technique: row.technique,
    iceType: row.iceType,
    imageUrl: row.imageUrl,
    origin: row.origin,
    isOfficialClassic: row.origin === 'CLASSIC' && row.verificationStatus === 'PUBLISHED',
    verificationStatus: row.verificationStatus,
    version: row.version,
    updatedAt: row.updatedAt,
  };
}

/** Ingredients in recipe order, optionally scaled from the recipe's servings to `servings`. */
export function toRecipeIngredients(
  row: RecipeDetailRow,
  servings?: number,
): RecipeIngredientDto[] {
  const ingredients = row.ingredients.map((line) => ({
    id: line.id,
    ingredientId: line.ingredientId,
    name: line.ingredient.name,
    quantity: toNumber(line.quantity),
    unit: line.unit,
    optional: line.optional,
    position: line.position,
  }));
  return servings === undefined
    ? ingredients
    : scaleIngredients(ingredients, row.servings, servings);
}

export function toRecipeSteps(row: RecipeDetailRow): RecipeStepDto[] {
  return row.steps.map((step) => ({
    id: step.id,
    stepNumber: step.stepNumber,
    instruction: step.instruction,
    durationSeconds: step.durationSeconds,
    imageUrl: step.imageUrl,
  }));
}

export function toRecipeDetail(row: RecipeDetailRow, servings?: number): RecipeDetailDto {
  const allergens = new Set<Allergen>(row.ingredients.flatMap((line) => line.ingredient.allergens));
  return {
    ...toRecipeSummary(row),
    history: row.history,
    servings: servings ?? row.servings,
    baseServings: row.servings,
    garnish: row.garnish,
    alcoholPercentageEstimated: toNumber(row.alcoholPercentageEstimated),
    instructions: row.instructions,
    source: row.source,
    categories: row.categories
      .map((c) => c.category)
      .sort((a, b) => a.name.localeCompare(b.name, 'es')),
    allergens: [...allergens].sort(),
    ingredients: toRecipeIngredients(row, servings),
    steps: toRecipeSteps(row),
    publishedAt: row.publishedAt,
    createdAt: row.createdAt,
  };
}
