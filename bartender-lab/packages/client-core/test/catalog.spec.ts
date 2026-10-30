import { importBundledCatalog, upsertRecipe } from '../src/catalog-store';
import { catalog, ingredientId, openClient, recipeId } from './helpers';

describe('catálogo offline incorporado', () => {
  it('loads the bundled catalog on first open, without network or account', async () => {
    const { client } = await openClient();
    const recipes = await client.catalog.listRecipes();
    expect(recipes.map((r) => r.name)).toEqual([
      'Americano',
      'Daiquiri',
      'Manhattan',
      'Margarita',
      'Mojito',
      'Negroni',
      'Whiskey Sour',
    ]);
    expect(recipes.every((r) => r.isOfficialClassic && !r.outdated && !r.withdrawn)).toBe(true);
  });

  it('does not import the same bundle twice', async () => {
    const { db } = await openClient();
    expect(await importBundledCatalog(db, catalog)).toBe(false);
  });

  it('never lets an older bundle overwrite a newer downloaded recipe', async () => {
    const { client, db } = await openClient();
    const negroni = catalog.recipes.find((r) => r.slug === 'negroni')!;
    await upsertRecipe(db, { ...negroni, version: 3, garnish: 'Piel de naranja' }, 'download');
    expect(await upsertRecipe(db, negroni, 'bundle')).toBe(false);
    expect((await client.catalog.getRecipe(negroni.id))?.garnish).toBe('Piel de naranja');
  });

  it('searches by recipe or ingredient name ignoring accents and case', async () => {
    const { client } = await openClient();
    expect((await client.catalog.listRecipes({ search: 'LIMON' })).map((r) => r.name)).toEqual([
      'Whiskey Sour',
    ]);
    expect((await client.catalog.listRecipes({ search: 'menta' })).map((r) => r.name)).toEqual([
      'Mojito',
    ]);
    expect((await client.catalog.listRecipes({ search: 'neg' })).map((r) => r.name)).toEqual([
      'Negroni',
    ]);
  });

  it('filters by category and ingredient', async () => {
    const { client } = await openClient();
    const sours = (await client.catalog.listCategories('RECIPE')).find((c) => c.name === 'Sours')!;
    expect(sours.recipeCount).toBe(3);
    expect((await client.catalog.listRecipes({ categoryId: sours.id })).map((r) => r.name)).toEqual(
      ['Daiquiri', 'Margarita', 'Whiskey Sour'],
    );
    const campari = ingredientId('Campari');
    expect(
      (await client.catalog.listRecipes({ ingredientId: campari })).map((r) => r.name),
    ).toEqual(['Americano', 'Negroni']);
  });

  it('shows a recipe scaled to the requested servings', async () => {
    const { client } = await openClient();
    const mojito = await client.catalog.getRecipe(recipeId('mojito'), 4);
    expect(mojito).toMatchObject({
      servings: 4,
      baseServings: 1,
      iceType: 'CRUSHED',
      glassware: { name: 'Vaso highball' },
    });
    expect(mojito!.ingredients.map((i) => [i.name, i.quantity, i.unit])).toEqual([
      ['Ron blanco', 180, 'ML'],
      ['Jugo de lima', 80, 'ML'],
      ['Menta', 24, 'SPRIG'],
      ['Azúcar blanca de caña', 8, 'TEASPOON'],
      ['Agua con gas', null, 'TOP_UP'],
    ]);
    expect(mojito!.steps).toHaveLength(4);
  });

  it('reports allergens of a recipe', async () => {
    const { client } = await openClient();
    expect((await client.catalog.getRecipe(recipeId('negroni')))!.allergens).toEqual(['SULPHITES']);
  });

  it('returns techniques with their equipment and common mistakes', async () => {
    const { client } = await openClient();
    const techniques = await client.catalog.listTechniques();
    expect(techniques.map((t) => t.name)).toEqual([
      'Batido',
      'Directo',
      'Macerado',
      'Refrescado (removido)',
    ]);
    const shake = techniques.find((t) => t.name === 'Batido')!;
    expect(shake.equipment).toEqual(['Coctelera', 'Colador Hawthorne', 'Medidor (jigger)']);
    expect(shake.commonMistakes.length).toBeGreaterThan(0);
  });
});

describe('coincidencia offline con Mi barra', () => {
  it('finds exact and adaptable recipes from the stored inventory', async () => {
    const { client } = await openClient();
    for (const name of ['Gin', 'Campari', 'Vermut rojo', 'Bourbon', 'Amargo de Angostura']) {
      await client.inventory.save({ ingredientId: ingredientId(name) });
    }
    const results = await client.catalog.match({ includeIncomplete: false });
    expect(results.map((r) => [r.recipe.name, r.classification])).toEqual([
      ['Negroni', 'EXACT_MATCH'],
      ['Manhattan', 'ADAPTABLE'],
    ]);
    expect(results[1].substitutions).toEqual([
      expect.objectContaining({ ingredientName: 'Whiskey de centeno', substituteName: 'Bourbon' }),
    ]);
  });

  it('treats an ingredient with quantity 0 as depleted', async () => {
    const { client } = await openClient();
    for (const name of ['Gin', 'Campari', 'Vermut rojo'])
      await client.inventory.save({ ingredientId: ingredientId(name) });
    await client.inventory.save({ ingredientId: ingredientId('Gin'), quantity: 0, unit: 'ML' });
    expect(await client.catalog.match({ includeIncomplete: false })).toEqual([]);
    expect((await client.inventory.list()).find((i) => i.ingredientName === 'Gin')?.depleted).toBe(
      true,
    );
  });

  it('marks which recipe ingredients are already in the bar', async () => {
    const { client } = await openClient();
    await client.inventory.save({ ingredientId: ingredientId('Gin') });
    const negroni = await client.catalog.getRecipe(recipeId('negroni'));
    expect(negroni!.ingredients.map((i) => [i.name, i.inInventory])).toEqual([
      ['Gin', true],
      ['Campari', false],
      ['Vermut rojo', false],
    ]);
  });
});
