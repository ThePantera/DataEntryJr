import type { Allergen, Difficulty, IceType, Unit } from '@bartender-lab/shared';

const UNIT_NAMES: Record<Unit, [singular: string, plural: string]> = {
  ML: ['ml', 'ml'],
  CL: ['cl', 'cl'],
  OZ: ['oz', 'oz'],
  GRAM: ['g', 'g'],
  DASH: ['golpe', 'golpes'],
  DROP: ['gota', 'gotas'],
  BARSPOON: ['cucharada de bar', 'cucharadas de bar'],
  TEASPOON: ['cucharadita', 'cucharaditas'],
  TABLESPOON: ['cucharada', 'cucharadas'],
  UNIT: ['unidad', 'unidades'],
  SLICE: ['rodaja', 'rodajas'],
  WEDGE: ['gajo', 'gajos'],
  SPRIG: ['rama', 'ramas'],
  LEAF: ['hoja', 'hojas'],
  PINCH: ['pizca', 'pizcas'],
  TOP_UP: ['completar', 'completar'],
};

export function formatNumber(value: number): string {
  return String(Number(value.toFixed(3))).replace('.', ',');
}

export function unitLabel(unit: Unit, quantity = 2): string {
  const [singular, plural] = UNIT_NAMES[unit];
  return quantity === 1 ? singular : plural;
}

/** "22,5 ml", "3 golpes", "Completar". */
export function formatQuantity(quantity: number | null, unit: Unit | null): string {
  if (unit === 'TOP_UP') return 'Completar';
  if (quantity === null) return '';
  if (unit === null) return formatNumber(quantity);
  return `${formatNumber(quantity)} ${unitLabel(unit, quantity)}`;
}

const ICE: Record<IceType, string> = {
  NONE: 'Sin hielo',
  CUBED: 'Hielo en cubos',
  CRUSHED: 'Hielo picado',
  LARGE_CUBE: 'Cubo grande',
  SPHERE: 'Esfera de hielo',
  BLOCK: 'Bloque de hielo',
  SHAVED: 'Hielo raspado',
};

const DIFFICULTY: Record<Difficulty, string> = { EASY: 'Fácil', MEDIUM: 'Media', HARD: 'Difícil' };

const ALLERGENS: Record<Allergen, string> = {
  CELERY: 'Apio',
  GLUTEN: 'Gluten',
  CRUSTACEANS: 'Crustáceos',
  EGGS: 'Huevo',
  FISH: 'Pescado',
  LUPIN: 'Altramuces',
  MILK: 'Lácteos',
  MOLLUSCS: 'Moluscos',
  MUSTARD: 'Mostaza',
  TREE_NUTS: 'Frutos de cáscara',
  PEANUTS: 'Cacahuetes',
  SESAME: 'Sésamo',
  SOY: 'Soja',
  SULPHITES: 'Sulfitos',
};

export const iceLabel = (ice: IceType): string => ICE[ice];
export const difficultyLabel = (difficulty: Difficulty): string => DIFFICULTY[difficulty];
export const allergenLabel = (allergen: Allergen): string => ALLERGENS[allergen];

/** Units offered when entering quantities by hand. */
export const INPUT_UNITS: Unit[] = [
  'ML',
  'CL',
  'OZ',
  'UNIT',
  'GRAM',
  'DASH',
  'SPRIG',
  'LEAF',
  'SLICE',
  'WEDGE',
];
