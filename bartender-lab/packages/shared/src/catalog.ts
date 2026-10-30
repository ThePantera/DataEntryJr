import type { Allergen, CategoryKind, Difficulty, IceType, RecipeOrigin, Unit } from './enums';

/**
 * Offline catalog format: the content bundled inside the mobile app and stored in its SQLite
 * database. Ids are the same as on the server, so local favorites and inventory can be synced.
 */
export interface CatalogCategory {
  id: string;
  name: string;
  description: string | null;
  kind: CategoryKind;
  version: number;
}

export interface CatalogIngredient {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  alcoholPercentage: number;
  imageUrl: string | null;
  allergens: Allergen[];
  version: number;
}

export interface CatalogGlassware {
  id: string;
  name: string;
  description: string | null;
  capacityMl: number | null;
  imageUrl: string | null;
  version: number;
}

export interface CatalogEquipment {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  version: number;
}

export interface CatalogTechnique {
  id: string;
  name: string;
  description: string;
  durationSeconds: number | null;
  instructions: string;
  commonMistakes: string[];
  equipmentIds: string[];
  version: number;
}

export interface CatalogRecipeIngredient {
  id: string;
  ingredientId: string;
  quantity: number | null;
  unit: Unit;
  optional: boolean;
  position: number;
}

export interface CatalogRecipeStep {
  id: string;
  stepNumber: number;
  instruction: string;
  durationSeconds: number | null;
  imageUrl: string | null;
}

export interface CatalogRecipe {
  id: string;
  name: string;
  slug: string;
  description: string;
  history: string | null;
  difficulty: Difficulty;
  preparationTimeSeconds: number | null;
  servings: number;
  glasswareId: string | null;
  techniqueId: string | null;
  iceType: IceType | null;
  garnish: string | null;
  alcoholPercentageEstimated: number | null;
  instructions: string | null;
  imageUrl: string | null;
  source: string | null;
  origin: RecipeOrigin;
  version: number;
  categoryIds: string[];
  ingredients: CatalogRecipeIngredient[];
  steps: CatalogRecipeStep[];
}

export interface CatalogSubstitution {
  id: string;
  ingredientId: string;
  substituteId: string;
  recipeId: string | null;
  ratio: number;
  notes: string | null;
}

export interface CatalogBundle {
  formatVersion: 1;
  categories: CatalogCategory[];
  ingredients: CatalogIngredient[];
  glassware: CatalogGlassware[];
  equipment: CatalogEquipment[];
  techniques: CatalogTechnique[];
  recipes: CatalogRecipe[];
  substitutions: CatalogSubstitution[];
}
