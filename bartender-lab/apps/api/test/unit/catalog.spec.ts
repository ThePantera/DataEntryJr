import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog } from '../../prisma/catalog';
import { catalogId } from '../../prisma/catalog-ids';

describe('catálogo inicial', () => {
  const catalog = buildCatalog();

  it('derives every id deterministically', () => {
    expect(catalog.recipes.find((r) => r.slug === 'negroni')?.id).toBe(catalogId('recipe:negroni'));
    expect(buildCatalog()).toEqual(catalog);
  });

  it('has no duplicate ids', () => {
    const ids = [
      ...catalog.categories,
      ...catalog.ingredients,
      ...catalog.glassware,
      ...catalog.equipment,
      ...catalog.techniques,
      ...catalog.recipes,
      ...catalog.recipes.flatMap((r) => [...r.ingredients, ...r.steps]),
      ...catalog.substitutions,
    ].map((x) => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('matches the copy bundled in the mobile app (run npm run catalog:export)', () => {
    const bundled = JSON.parse(
      readFileSync(
        join(__dirname, '..', '..', '..', '..', 'packages', 'client-core', 'data', 'catalog.json'),
        'utf8',
      ),
    );
    expect(bundled).toEqual(catalog);
  });
});
