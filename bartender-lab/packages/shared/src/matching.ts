/**
 * Deterministic recipe matching engine (spec section 7).
 *
 * Rules — these are fixed in code and are never delegated to the AI assistant:
 *  - EXACT_MATCH: the user has every required (non-optional) ingredient.
 *  - ADAPTABLE:   every missing required ingredient is covered by an approved, compatible substitution.
 *  - INCOMPLETE:  at least one required ingredient is missing with no approved substitution.
 *  - Optional ingredients never count as required.
 *  - A substitution is compatible with a recipe when it is global (recipeId = null) or specific
 *    to that recipe, the user has the substitute, and the substitute is not already an ingredient
 *    of the same recipe. Substitutions are not chained (A→B→C does not make A→C).
 *  - Callers must only pass approved substitutions.
 */

export type MatchClassification = 'EXACT_MATCH' | 'ADAPTABLE' | 'INCOMPLETE';

export interface MatchRecipeIngredient {
  ingredientId: string;
  optional: boolean;
}

export interface MatchRecipe {
  id: string;
  name: string;
  ingredients: readonly MatchRecipeIngredient[];
}

export interface MatchSubstitution {
  ingredientId: string;
  substituteId: string;
  /** null = applies to every recipe; otherwise only to this recipe. */
  recipeId: string | null;
  ratio: number;
}

export interface AppliedSubstitution {
  ingredientId: string;
  substituteId: string;
  ratio: number;
}

export interface RecipeMatchResult {
  recipeId: string;
  recipeName: string;
  classification: MatchClassification;
  requiredCount: number;
  availableRequired: string[];
  substitutions: AppliedSubstitution[];
  missingRequired: string[];
  missingOptional: string[];
}

export interface MatchOptions {
  /** Include INCOMPLETE recipes in the result (default true). */
  includeIncomplete?: boolean;
  /** Drop INCOMPLETE recipes missing more than this many required ingredients. */
  maxMissing?: number;
}

const CLASSIFICATION_RANK: Record<MatchClassification, number> = {
  EXACT_MATCH: 0,
  ADAPTABLE: 1,
  INCOMPLETE: 2,
};

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

function pickSubstitution(
  recipe: MatchRecipe,
  ingredientId: string,
  available: ReadonlySet<string>,
  recipeIngredientIds: ReadonlySet<string>,
  substitutions: readonly MatchSubstitution[],
): MatchSubstitution | undefined {
  const candidates = substitutions.filter(
    (s) =>
      s.ingredientId === ingredientId &&
      (s.recipeId === null || s.recipeId === recipe.id) &&
      available.has(s.substituteId) &&
      !recipeIngredientIds.has(s.substituteId),
  );
  candidates.sort((a, b) => {
    const specificity = Number(b.recipeId !== null) - Number(a.recipeId !== null);
    return specificity !== 0 ? specificity : compareStrings(a.substituteId, b.substituteId);
  });
  return candidates[0];
}

export function matchRecipe(
  recipe: MatchRecipe,
  available: ReadonlySet<string>,
  substitutions: readonly MatchSubstitution[],
): RecipeMatchResult {
  const recipeIngredientIds = new Set(recipe.ingredients.map((i) => i.ingredientId));
  const result: RecipeMatchResult = {
    recipeId: recipe.id,
    recipeName: recipe.name,
    classification: 'EXACT_MATCH',
    requiredCount: 0,
    availableRequired: [],
    substitutions: [],
    missingRequired: [],
    missingOptional: [],
  };

  for (const { ingredientId, optional } of recipe.ingredients) {
    if (optional) {
      if (!available.has(ingredientId)) result.missingOptional.push(ingredientId);
      continue;
    }
    result.requiredCount += 1;
    if (available.has(ingredientId)) {
      result.availableRequired.push(ingredientId);
      continue;
    }
    const substitution = pickSubstitution(
      recipe,
      ingredientId,
      available,
      recipeIngredientIds,
      substitutions,
    );
    if (substitution) {
      result.substitutions.push({
        ingredientId,
        substituteId: substitution.substituteId,
        ratio: substitution.ratio,
      });
    } else {
      result.missingRequired.push(ingredientId);
    }
  }

  if (result.missingRequired.length > 0) result.classification = 'INCOMPLETE';
  else if (result.substitutions.length > 0) result.classification = 'ADAPTABLE';
  return result;
}

export function matchRecipes(
  recipes: readonly MatchRecipe[],
  availableIngredientIds: Iterable<string>,
  substitutions: readonly MatchSubstitution[],
  options: MatchOptions = {},
): RecipeMatchResult[] {
  const { includeIncomplete = true, maxMissing } = options;
  const available = new Set(availableIngredientIds);

  return recipes
    .map((recipe) => matchRecipe(recipe, available, substitutions))
    .filter((r) => {
      if (r.classification !== 'INCOMPLETE') return true;
      if (!includeIncomplete) return false;
      return maxMissing === undefined || r.missingRequired.length <= maxMissing;
    })
    .sort(
      (a, b) =>
        CLASSIFICATION_RANK[a.classification] - CLASSIFICATION_RANK[b.classification] ||
        a.missingRequired.length - b.missingRequired.length ||
        a.substitutions.length - b.substitutions.length ||
        compareStrings(a.recipeName.toLowerCase(), b.recipeName.toLowerCase()) ||
        compareStrings(a.recipeId, b.recipeId),
    );
}
