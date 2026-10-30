import { allergenLabel, difficultyLabel, formatQuantity, iceLabel } from '../src/format';

describe('formatQuantity', () => {
  it('uses a decimal comma and short units for measures', () => {
    expect(formatQuantity(22.5, 'ML')).toBe('22,5 ml');
    expect(formatQuantity(60, 'ML')).toBe('60 ml');
    expect(formatQuantity(0.75, 'OZ')).toBe('0,75 oz');
  });

  it('pluralises countable units in Spanish', () => {
    expect(formatQuantity(1, 'DASH')).toBe('1 golpe');
    expect(formatQuantity(3, 'DASH')).toBe('3 golpes');
    expect(formatQuantity(2, 'BARSPOON')).toBe('2 cucharadas de bar');
    expect(formatQuantity(6, 'SPRIG')).toBe('6 ramas');
    expect(formatQuantity(1, 'SLICE')).toBe('1 rodaja');
  });

  it('describes "top up" and missing quantities', () => {
    expect(formatQuantity(null, 'TOP_UP')).toBe('Completar');
    expect(formatQuantity(null, null)).toBe('');
    expect(formatQuantity(2, null)).toBe('2');
  });
});

describe('labels', () => {
  it('translates enums to Spanish', () => {
    expect(iceLabel('CRUSHED')).toBe('Hielo picado');
    expect(iceLabel('NONE')).toBe('Sin hielo');
    expect(difficultyLabel('MEDIUM')).toBe('Media');
    expect(allergenLabel('SULPHITES')).toBe('Sulfitos');
  });
});
