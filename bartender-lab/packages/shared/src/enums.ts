/**
 * Domain enumerations shared by the API and the mobile app.
 * They mirror the Prisma enums one-to-one; the API has a test that keeps them in sync.
 */

export const UNITS = [
  'ML',
  'CL',
  'OZ',
  'DASH',
  'DROP',
  'BARSPOON',
  'TEASPOON',
  'TABLESPOON',
  'GRAM',
  'UNIT',
  'SLICE',
  'WEDGE',
  'SPRIG',
  'LEAF',
  'PINCH',
  'TOP_UP',
] as const;
export type Unit = (typeof UNITS)[number];

export const ICE_TYPES = [
  'NONE',
  'CUBED',
  'CRUSHED',
  'LARGE_CUBE',
  'SPHERE',
  'BLOCK',
  'SHAVED',
] as const;
export type IceType = (typeof ICE_TYPES)[number];

export const DIFFICULTIES = ['EASY', 'MEDIUM', 'HARD'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const VERIFICATION_STATUSES = ['DRAFT', 'REVIEW', 'VERIFIED', 'PUBLISHED'] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** CLASSIC = documented classic recipe; ORIGINAL = original creation, always labelled as such. */
export const RECIPE_ORIGINS = ['CLASSIC', 'ORIGINAL'] as const;
export type RecipeOrigin = (typeof RECIPE_ORIGINS)[number];

/** The 14 allergens that EU Regulation 1169/2011 requires to be declared. */
export const ALLERGENS = [
  'CELERY',
  'GLUTEN',
  'CRUSTACEANS',
  'EGGS',
  'FISH',
  'LUPIN',
  'MILK',
  'MOLLUSCS',
  'MUSTARD',
  'TREE_NUTS',
  'PEANUTS',
  'SESAME',
  'SOY',
  'SULPHITES',
] as const;
export type Allergen = (typeof ALLERGENS)[number];

export const USER_ROLES = ['USER', 'EDITOR', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const CATEGORY_KINDS = ['INGREDIENT', 'RECIPE'] as const;
export type CategoryKind = (typeof CATEGORY_KINDS)[number];

export const RESOURCE_TYPES = [
  'RECIPE',
  'INGREDIENT',
  'TECHNIQUE',
  'GLASSWARE',
  'EQUIPMENT',
  'CATEGORY',
] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
