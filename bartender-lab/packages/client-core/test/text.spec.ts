import { normalizeText } from '../src/text';

describe('normalizeText', () => {
  it('removes Spanish, Portuguese and French accents and lowercases', () => {
    expect(normalizeText('  Piña Colada ÁÉÍÓÚ Ü ç Ñ ')).toBe('pina colada aeiou u c n');
  });

  it('does not depend on String.prototype.normalize (missing in some mobile engines)', () => {
    const original = String.prototype.normalize;
    // @ts-expect-error simulate an engine without normalize()
    delete String.prototype.normalize;
    try {
      expect(normalizeText('Limón')).toBe('limon');
    } finally {
      String.prototype.normalize = original;
    }
  });
});
