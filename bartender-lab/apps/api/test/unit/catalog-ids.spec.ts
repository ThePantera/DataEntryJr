import { catalogId } from '../../prisma/catalog-ids';

describe('catalogId (UUID v5)', () => {
  it('matches the RFC 4122 reference vector', () => {
    // uuid v5 of "www.example.com" in the DNS namespace.
    expect(catalogId('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('is stable and distinguishes resource kinds', () => {
    expect(catalogId('ingredient:Gin')).toBe(catalogId('ingredient:Gin'));
    expect(catalogId('ingredient:Gin')).not.toBe(catalogId('recipe:Gin'));
    expect(catalogId('ingredient:Gin')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
