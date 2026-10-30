import type {
  Allergen,
  CategoryKind,
  Difficulty,
  IceType,
  RecipeOrigin,
  ResourceType,
  Unit,
  UserRole,
} from '@bartender-lab/shared';

/** Shapes returned by the BARTENDER LAB API (see docs/api/openapi.json). */
export interface ApiUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface ApiAuthResponse {
  user: ApiUser;
  accessToken: string;
  refreshToken: string;
}

export interface ApiManifestEntry {
  resourceType: ResourceType;
  resourceId: string;
  version: number;
  deleted: boolean;
  updatedAt: string;
}

export interface ApiFavorite {
  id: string;
  recipeId: string;
  version: number;
  deletedAt: string | null;
}

export interface ApiInventoryItem {
  id: string;
  ingredientId: string;
  quantity: number | null;
  unit: Unit | null;
  expirationDate: string | null;
  version: number;
  deletedAt: string | null;
}

export interface ApiShoppingList {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface ApiShoppingListItem {
  id: string;
  shoppingListId: string;
  ingredientId: string;
  quantity: number | null;
  unit: Unit | null;
  completed: boolean;
  version: number;
  deletedAt: string | null;
}

export interface ApiChanges {
  content: ApiManifestEntry[];
  user: {
    favorites: ApiFavorite[];
    inventory: ApiInventoryItem[];
    shoppingLists: ApiShoppingList[];
    shoppingListItems: ApiShoppingListItem[];
  } | null;
  nextSince: string;
}

export interface ApiPushResult {
  opId: string;
  entityType: 'FAVORITE' | 'INVENTORY' | 'SHOPPING_LIST' | 'SHOPPING_LIST_ITEM';
  entityId: string;
  status: 'APPLIED' | 'MERGED' | 'CONFLICT' | 'REJECTED';
  reason?: string;
  canonicalId?: string;
  entity: Record<string, unknown> | null;
  replayed: boolean;
}

export interface ApiCategory {
  id: string;
  name: string;
  description: string | null;
  kind: CategoryKind;
  version: number;
}

export interface ApiIngredient {
  id: string;
  name: string;
  description: string | null;
  category: { id: string; name: string };
  alcoholPercentage: number;
  imageUrl: string | null;
  allergens: Allergen[];
  version: number;
}

export interface ApiGlassware {
  id: string;
  name: string;
  description: string | null;
  capacityMl: number | null;
  imageUrl: string | null;
  version: number;
}

export interface ApiEquipment {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  version: number;
}

export interface ApiTechnique {
  id: string;
  name: string;
  description: string;
  durationSeconds: number | null;
  instructions: string;
  commonMistakes: string[];
  equipment: Array<{ id: string; name: string }>;
  version: number;
}

export interface ApiRecipeSummary {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  origin: RecipeOrigin;
  version: number;
}

export interface ApiRecipeDetail extends ApiRecipeSummary {
  slug: string;
  history: string | null;
  preparationTimeSeconds: number | null;
  baseServings: number;
  glassware: { id: string } | null;
  technique: { id: string } | null;
  iceType: IceType | null;
  garnish: string | null;
  alcoholPercentageEstimated: number | null;
  instructions: string | null;
  imageUrl: string | null;
  source: string | null;
  categories: Array<{ id: string }>;
  ingredients: Array<{
    id: string;
    ingredientId: string;
    quantity: number | null;
    unit: Unit;
    optional: boolean;
    position: number;
  }>;
  steps: Array<{
    id: string;
    stepNumber: number;
    instruction: string;
    durationSeconds: number | null;
    imageUrl: string | null;
  }>;
}

export interface ApiPage<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiSubstitution {
  id: string;
  ingredientId: string;
  substituteId: string;
  recipeId: string | null;
  ratio: number;
  notes: string | null;
}
