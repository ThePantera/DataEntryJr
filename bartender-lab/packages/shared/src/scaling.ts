import type { Unit } from './enums';

export const MAX_SERVINGS = 100;

export class ScalingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScalingError';
  }
}

/**
 * Rounding step per unit: the smallest amount a bartender can reasonably measure.
 * Countable units (dashes, leaves, slices...) are rounded to whole numbers.
 */
const ROUNDING_STEP: Record<Unit, number | null> = {
  ML: 0.5,
  CL: 0.05,
  OZ: 0.125,
  GRAM: 0.5,
  BARSPOON: 0.5,
  TEASPOON: 0.25,
  TABLESPOON: 0.25,
  DASH: 1,
  DROP: 1,
  UNIT: 1,
  SLICE: 1,
  WEDGE: 1,
  SPRIG: 1,
  LEAF: 1,
  PINCH: 1,
  TOP_UP: null,
};

/**
 * Scales a single quantity by `factor`, rounding to the unit's step.
 * A positive quantity never rounds down to zero, and TOP_UP ("completar con") has no quantity.
 */
export function scaleQuantity(quantity: number | null, unit: Unit, factor: number): number | null {
  if (!Number.isFinite(factor) || factor <= 0) {
    throw new ScalingError(`Scaling factor must be a positive number, got ${factor}`);
  }
  const step = ROUNDING_STEP[unit];
  if (quantity === null || step === null) {
    return null;
  }
  const rounded = Math.round((quantity * factor) / step) * step;
  const result = rounded === 0 && quantity > 0 ? step : rounded;
  return Number(result.toFixed(3));
}

export interface ScalableIngredient {
  quantity: number | null;
  unit: Unit;
}

function assertServings(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1 || value > MAX_SERVINGS) {
    throw new ScalingError(
      `${label} must be an integer between 1 and ${MAX_SERVINGS}, got ${value}`,
    );
  }
}

/** Scales a recipe's ingredient list from `baseServings` to `targetServings`. */
export function scaleIngredients<T extends ScalableIngredient>(
  ingredients: readonly T[],
  baseServings: number,
  targetServings: number,
): T[] {
  assertServings(baseServings, 'Base servings');
  assertServings(targetServings, 'Target servings');
  const factor = targetServings / baseServings;
  return ingredients.map((ingredient) => ({
    ...ingredient,
    quantity: scaleQuantity(ingredient.quantity, ingredient.unit, factor),
  }));
}
