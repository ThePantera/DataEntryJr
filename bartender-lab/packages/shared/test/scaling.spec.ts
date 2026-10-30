import { scaleIngredients, scaleQuantity, ScalingError } from '../src';

describe('scaleQuantity', () => {
  it('multiplies millilitres by the factor', () => {
    expect(scaleQuantity(30, 'ML', 3)).toBe(90);
  });

  it('rounds millilitres to the nearest half millilitre', () => {
    expect(scaleQuantity(22.5, 'ML', 2)).toBe(45);
    expect(scaleQuantity(20, 'ML', 1 / 3)).toBe(6.5);
  });

  it('rounds ounces to the nearest eighth of an ounce', () => {
    expect(scaleQuantity(0.75, 'OZ', 3)).toBe(2.25);
    expect(scaleQuantity(1, 'OZ', 1 / 3)).toBe(0.375);
  });

  it('rounds countable units to whole numbers', () => {
    expect(scaleQuantity(3, 'DASH', 2)).toBe(6);
    expect(scaleQuantity(6, 'SPRIG', 0.25)).toBe(2);
  });

  it('never scales a positive quantity down to zero', () => {
    expect(scaleQuantity(1, 'DASH', 0.25)).toBe(1);
    expect(scaleQuantity(0.5, 'ML', 0.1)).toBe(0.5);
  });

  it('keeps "top up" ingredients without a quantity', () => {
    expect(scaleQuantity(null, 'TOP_UP', 4)).toBeNull();
  });

  it('keeps a missing quantity as missing', () => {
    expect(scaleQuantity(null, 'ML', 2)).toBeNull();
  });

  it('rejects a non-positive factor', () => {
    expect(() => scaleQuantity(30, 'ML', 0)).toThrow(ScalingError);
    expect(() => scaleQuantity(30, 'ML', -1)).toThrow(ScalingError);
  });
});

describe('scaleIngredients', () => {
  const negroni = [
    { ingredientId: 'gin', quantity: 30, unit: 'ML' as const },
    { ingredientId: 'campari', quantity: 30, unit: 'ML' as const },
    { ingredientId: 'vermouth', quantity: 30, unit: 'ML' as const },
  ];

  it('scales every ingredient from the base servings to the target servings', () => {
    const scaled = scaleIngredients(negroni, 1, 4);
    expect(scaled.map((i) => i.quantity)).toEqual([120, 120, 120]);
  });

  it('keeps the other ingredient fields untouched', () => {
    const scaled = scaleIngredients(
      [{ ingredientId: 'gin', quantity: 30, unit: 'ML' as const, optional: true }],
      2,
      1,
    );
    expect(scaled[0]).toEqual({ ingredientId: 'gin', quantity: 15, unit: 'ML', optional: true });
  });

  it('rejects servings that are not positive integers', () => {
    expect(() => scaleIngredients(negroni, 1, 0)).toThrow(ScalingError);
    expect(() => scaleIngredients(negroni, 1, 1.5)).toThrow(ScalingError);
    expect(() => scaleIngredients(negroni, 0, 2)).toThrow(ScalingError);
  });

  it('rejects more servings than the supported maximum', () => {
    expect(() => scaleIngredients(negroni, 1, 101)).toThrow(ScalingError);
  });
});
