import { randomUUID } from 'node:crypto';
import { seedCatalog, type Catalog } from './fixtures';
import {
  API,
  bearer,
  createTestApp,
  createUser,
  resetDatabase,
  type TestContext,
  type TestUser,
} from './helpers';

describe('Recetas: consulta, escalado y coincidencia', () => {
  let ctx: TestContext;
  let catalog: Catalog;
  let user: TestUser;
  let editor: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    catalog = await seedCatalog(ctx);
    user = await createUser(ctx);
    editor = await createUser(ctx, 'EDITOR');
  });

  afterAll(() => ctx.app.close());

  const names = (body: { items: Array<{ name: string }> }) => body.items.map((r) => r.name);

  describe('GET /recipes', () => {
    it('lists only published recipes, without authentication', async () => {
      const res = await ctx.http().get(`${API}/recipes`).expect(200);
      expect(names(res.body)).toEqual(['Daiquiri', 'Jardín de Pruebas', 'Negroni', 'Whiskey Sour']);
      expect(res.body.total).toBe(4);
    });

    it('labels original creations and official classics', async () => {
      const res = await ctx.http().get(`${API}/recipes`).expect(200);
      const byName = Object.fromEntries(res.body.items.map((r: { name: string }) => [r.name, r]));
      expect(byName['Negroni']).toMatchObject({ origin: 'CLASSIC', isOfficialClassic: true });
      expect(byName['Jardín de Pruebas']).toMatchObject({
        origin: 'ORIGINAL',
        isOfficialClassic: false,
      });
    });

    it('searches by name, ingredient, category and origin', async () => {
      const search = await ctx.http().get(`${API}/recipes?search=sour`).expect(200);
      expect(names(search.body)).toEqual(['Whiskey Sour']);

      const byIngredient = await ctx
        .http()
        .get(`${API}/recipes?ingredientId=${catalog.ingredients.gin.id}`)
        .expect(200);
      expect(names(byIngredient.body)).toEqual(['Jardín de Pruebas', 'Negroni']);

      const byCategory = await ctx
        .http()
        .get(`${API}/recipes?categoryId=${catalog.categories.sours.id}`)
        .expect(200);
      expect(names(byCategory.body)).toEqual(['Daiquiri', 'Whiskey Sour']);

      const originals = await ctx.http().get(`${API}/recipes?origin=ORIGINAL`).expect(200);
      expect(names(originals.body)).toEqual(['Jardín de Pruebas']);
    });

    it('lets editors list drafts but not common users', async () => {
      await ctx.http().get(`${API}/recipes?status=DRAFT`).set(bearer(user)).expect(403);
      const res = await ctx
        .http()
        .get(`${API}/recipes?status=DRAFT`)
        .set(bearer(editor))
        .expect(200);
      expect(names(res.body)).toEqual(['Manhattan']);
    });
  });

  describe('GET /recipes/categories', () => {
    it('lists recipe categories with their number of published recipes', async () => {
      const res = await ctx.http().get(`${API}/recipes/categories`).expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({ name: 'Sours', publishedRecipeCount: 2 }),
        expect.objectContaining({ name: 'Spirit-forward', publishedRecipeCount: 1 }),
      ]);
    });
  });

  describe('GET /recipes/:id', () => {
    it('returns the full recipe with normalized ingredients and steps', async () => {
      const res = await ctx
        .http()
        .get(`${API}/recipes/${catalog.recipes.whiskeySour.id}`)
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Whiskey Sour',
        servings: 1,
        iceType: 'NONE',
        glassware: { name: 'Vaso old fashioned' },
        technique: { name: 'Batido' },
        categories: [{ name: 'Sours' }],
        isOfficialClassic: true,
        allergens: ['EGGS'],
      });
      expect(res.body.ingredients).toEqual([
        expect.objectContaining({ name: 'Bourbon', quantity: 45, unit: 'ML', optional: false }),
        expect.objectContaining({ name: 'Jugo de limón', quantity: 25, unit: 'ML' }),
        expect.objectContaining({ name: 'Jarabe de goma', quantity: 20, unit: 'ML' }),
        expect.objectContaining({
          name: 'Clara de huevo',
          quantity: 1,
          unit: 'DASH',
          optional: true,
        }),
      ]);
      expect(res.body.steps.map((s: { stepNumber: number }) => s.stepNumber)).toEqual([1, 2]);
    });

    it('hides unpublished recipes from the public and common users', async () => {
      const id = catalog.recipes.manhattan.id;
      await ctx.http().get(`${API}/recipes/${id}`).expect(404);
      await ctx.http().get(`${API}/recipes/${id}`).set(bearer(user)).expect(404);
      await ctx.http().get(`${API}/recipes/${id}`).set(bearer(editor)).expect(200);
    });

    it('answers 404 for unknown recipes and 400 for malformed ids', async () => {
      await ctx.http().get(`${API}/recipes/${randomUUID()}`).expect(404);
      await ctx.http().get(`${API}/recipes/abc`).expect(400);
    });
  });

  describe('escalado de cantidades', () => {
    it('scales quantities to the requested servings', async () => {
      const res = await ctx
        .http()
        .get(`${API}/recipes/${catalog.recipes.original.id}?servings=4`)
        .expect(200);
      expect(res.body.servings).toBe(4);
      expect(res.body.baseServings).toBe(1);
      expect(res.body.ingredients.map((i: { quantity: number | null }) => i.quantity)).toEqual([
        180,
        80,
        60,
        null,
      ]);
    });

    it('scales the ingredients endpoint too', async () => {
      const res = await ctx
        .http()
        .get(`${API}/recipes/${catalog.recipes.whiskeySour.id}/ingredients?servings=2`)
        .expect(200);
      expect(res.body.map((i: { quantity: number }) => i.quantity)).toEqual([90, 50, 40, 2]);
    });

    it('rejects invalid servings', async () => {
      const id = catalog.recipes.daiquiri.id;
      await ctx.http().get(`${API}/recipes/${id}?servings=0`).expect(400);
      await ctx.http().get(`${API}/recipes/${id}?servings=101`).expect(400);
      await ctx.http().get(`${API}/recipes/${id}?servings=1.5`).expect(400);
    });
  });

  describe('GET /recipes/:id/steps', () => {
    it('returns the ordered steps of a published recipe', async () => {
      const res = await ctx
        .http()
        .get(`${API}/recipes/${catalog.recipes.daiquiri.id}/steps`)
        .expect(200);
      expect(res.body).toEqual([
        expect.objectContaining({ stepNumber: 1, instruction: 'Medir los ingredientes.' }),
        expect.objectContaining({ stepNumber: 2, durationSeconds: 15 }),
      ]);
    });

    it('hides the steps of unpublished recipes', async () => {
      await ctx.http().get(`${API}/recipes/${catalog.recipes.manhattan.id}/steps`).expect(404);
    });
  });

  describe('GET /substitutions', () => {
    it('lists only approved substitutions, without authentication', async () => {
      const res = await ctx.http().get(`${API}/substitutions`).expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            ingredientId: catalog.ingredients.gommeSyrup.id,
            substituteId: catalog.ingredients.simpleSyrup.id,
            recipeId: null,
            ratio: 1,
          }),
          expect.objectContaining({
            ingredientId: catalog.ingredients.bourbon.id,
            recipeId: catalog.recipes.whiskeySour.id,
          }),
        ]),
      );
    });
  });

  describe('POST /recipes/match', () => {
    const match = (body: object) => ctx.http().post(`${API}/recipes/match`).send(body);
    const summary = (results: Array<{ recipeName: string; classification: string }>) =>
      results.map((r) => [r.recipeName, r.classification]);

    it('classifies recipes as exact, adaptable or incomplete', async () => {
      const i = catalog.ingredients;
      const res = await match({
        ingredientIds: [
          i.whiteRum.id,
          i.limeJuice.id,
          i.simpleSyrup.id,
          i.bourbon.id,
          i.lemonJuice.id,
        ],
      }).expect(200);

      expect(summary(res.body.results)).toEqual([
        ['Daiquiri', 'EXACT_MATCH'],
        ['Whiskey Sour', 'ADAPTABLE'],
        ['Jardín de Pruebas', 'INCOMPLETE'],
        ['Negroni', 'INCOMPLETE'],
      ]);
      const sour = res.body.results[1];
      expect(sour.substitutions).toEqual([
        expect.objectContaining({
          ingredientName: 'Jarabe de goma',
          substituteName: 'Jarabe simple',
          ratio: 1,
        }),
      ]);
      expect(sour.missingOptional).toEqual([expect.objectContaining({ name: 'Clara de huevo' })]);
    });

    it('never includes unpublished recipes', async () => {
      const i = catalog.ingredients;
      const res = await match({
        ingredientIds: [i.rye.id, i.sweetVermouth.id, i.angostura.id],
      }).expect(200);
      expect(res.body.results.map((r: { recipeName: string }) => r.recipeName)).not.toContain(
        'Manhattan',
      );
    });

    it('ignores substitutions that are not approved', async () => {
      const i = catalog.ingredients;
      const res = await match({
        ingredientIds: [i.whiteRum.id, i.lemonJuice.id, i.simpleSyrup.id],
        includeIncomplete: false,
      }).expect(200);
      expect(res.body.results).toEqual([]);
    });

    it('applies recipe-specific substitutions', async () => {
      const i = catalog.ingredients;
      const res = await match({
        ingredientIds: [i.rye.id, i.lemonJuice.id, i.gommeSyrup.id],
        includeIncomplete: false,
      }).expect(200);
      expect(summary(res.body.results)).toEqual([['Whiskey Sour', 'ADAPTABLE']]);
    });

    it('requires authentication to match against the stored inventory', async () => {
      await match({ useInventory: true }).expect(401);
    });

    it('validates the request', async () => {
      await match({ ingredientIds: ['nope'] }).expect(400);
      await match({ ingredientIds: [], maxMissing: -1 }).expect(400);
    });
  });
});

describe('Recetas: flujo editorial y permisos', () => {
  let ctx: TestContext;
  let catalog: Catalog;
  let user: TestUser;
  let editor: TestUser;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    catalog = await seedCatalog(ctx);
    user = await createUser(ctx);
    editor = await createUser(ctx, 'EDITOR');
    admin = await createUser(ctx, 'ADMIN');
  });

  afterAll(() => ctx.app.close());

  const draft = () => ({
    name: 'Gimlet',
    description: 'Gin y lima.',
    difficulty: 'EASY',
    ingredients: [
      { ingredientId: catalog.ingredients.gin.id, quantity: 60, unit: 'ML' },
      { ingredientId: catalog.ingredients.limeJuice.id, quantity: 20, unit: 'ML' },
    ],
    steps: [{ instruction: 'Batir con hielo.' }, { instruction: 'Colar en copa fría.' }],
  });

  const manifestEntry = (id: string) =>
    ctx.prisma.downloadManifest.findUnique({
      where: { resourceType_resourceId: { resourceType: 'RECIPE', resourceId: id } },
    });

  it('does not let anonymous or common users create recipes', async () => {
    await ctx.http().post(`${API}/recipes`).send(draft()).expect(401);
    await ctx.http().post(`${API}/recipes`).set(bearer(user)).send(draft()).expect(403);
  });

  it('validates references and quantities when creating', async () => {
    const bad = draft();
    bad.ingredients[0].ingredientId = randomUUID();
    await ctx.http().post(`${API}/recipes`).set(bearer(editor)).send(bad).expect(400);

    const duplicated = draft();
    duplicated.ingredients[1].ingredientId = catalog.ingredients.gin.id;
    await ctx.http().post(`${API}/recipes`).set(bearer(editor)).send(duplicated).expect(400);

    const noQuantity = {
      ...draft(),
      ingredients: [{ ingredientId: catalog.ingredients.gin.id, unit: 'ML' }],
    };
    await ctx.http().post(`${API}/recipes`).set(bearer(editor)).send(noQuantity).expect(400);
  });

  it('runs the full DRAFT → REVIEW → VERIFIED → PUBLISHED workflow', async () => {
    const created = await ctx
      .http()
      .post(`${API}/recipes`)
      .set(bearer(editor))
      .send(draft())
      .expect(201);
    const id = created.body.id;
    expect(created.body).toMatchObject({ verificationStatus: 'DRAFT', version: 1, slug: 'gimlet' });
    await ctx.http().get(`${API}/recipes/${id}`).expect(404);

    const status = (actor: TestUser, to: string) =>
      ctx.http().post(`${API}/recipes/${id}/status`).set(bearer(actor)).send({ status: to });

    await status(editor, 'PUBLISHED').expect(409);
    await status(editor, 'REVIEW').expect(200);

    const incomplete = await status(editor, 'VERIFIED').expect(422);
    expect(incomplete.body.issues).toEqual([
      'MISSING_METHOD',
      'MISSING_GLASSWARE',
      'MISSING_ICE_TYPE',
      'MISSING_SOURCE',
    ]);

    await ctx
      .http()
      .patch(`${API}/recipes/${id}`)
      .set(bearer(editor))
      .send({
        version: 1,
        techniqueId: catalog.techniques.shake.id,
        glasswareId: catalog.glassware.coupe.id,
        iceType: 'NONE',
        source: 'Receta clásica documentada',
      })
      .expect(200);

    await status(editor, 'VERIFIED').expect(200);
    await status(editor, 'PUBLISHED').expect(403);
    expect(await manifestEntry(id)).toBeNull();

    const published = await status(admin, 'PUBLISHED').expect(200);
    expect(published.body).toMatchObject({
      verificationStatus: 'PUBLISHED',
      isOfficialClassic: true,
    });
    expect(published.body.publishedAt).toEqual(expect.any(String));
    await ctx.http().get(`${API}/recipes/${id}`).expect(200);
    expect(await manifestEntry(id)).toMatchObject({ version: 2, deleted: false });
  });

  it('only lets admins modify official recipes', async () => {
    const id = catalog.recipes.negroni.id;
    const change = { description: 'Cambio no autorizado' };
    await ctx.http().patch(`${API}/recipes/${id}`).set(bearer(user)).send(change).expect(403);
    await ctx.http().patch(`${API}/recipes/${id}`).set(bearer(editor)).send(change).expect(403);

    const res = await ctx
      .http()
      .patch(`${API}/recipes/${id}`)
      .set(bearer(admin))
      .send({ description: 'Partes iguales.', version: 1 })
      .expect(200);
    expect(res.body).toMatchObject({ description: 'Partes iguales.', version: 2 });
    expect(await manifestEntry(id)).toMatchObject({ version: 2, deleted: false });
  });

  it('refuses edits that would leave an official recipe incomplete', async () => {
    const res = await ctx
      .http()
      .patch(`${API}/recipes/${catalog.recipes.daiquiri.id}`)
      .set(bearer(admin))
      .send({ glasswareId: null })
      .expect(422);
    expect(res.body.issues).toEqual(['MISSING_GLASSWARE']);
  });

  it('rejects an edit based on an outdated version', async () => {
    await ctx
      .http()
      .patch(`${API}/recipes/${catalog.recipes.manhattan.id}`)
      .set(bearer(editor))
      .send({ description: 'x', version: 7 })
      .expect(409);
  });

  it('rejects nulls for required fields', async () => {
    await ctx
      .http()
      .patch(`${API}/recipes/${catalog.recipes.manhattan.id}`)
      .set(bearer(editor))
      .send({ name: null })
      .expect(400);
  });

  it('withdraws an unpublished recipe from the download manifest', async () => {
    const id = catalog.recipes.whiskeySour.id;
    await ctx
      .http()
      .post(`${API}/recipes/${id}/status`)
      .set(bearer(editor))
      .send({ status: 'DRAFT' })
      .expect(403);
    await ctx
      .http()
      .post(`${API}/recipes/${id}/status`)
      .set(bearer(admin))
      .send({ status: 'DRAFT' })
      .expect(200);
    await ctx.http().get(`${API}/recipes/${id}`).expect(404);
    expect(await manifestEntry(id)).toMatchObject({ deleted: true });
  });

  it('marks original creations as such', async () => {
    const created = await ctx
      .http()
      .post(`${API}/recipes`)
      .set(bearer(editor))
      .send({ ...draft(), name: 'Gimlet de la casa', origin: 'ORIGINAL' })
      .expect(201);
    expect(created.body).toMatchObject({
      origin: 'ORIGINAL',
      isOfficialClassic: false,
      slug: 'gimlet-de-la-casa',
    });
  });

  it('generates unique slugs from accented names', async () => {
    const first = await ctx
      .http()
      .post(`${API}/recipes`)
      .set(bearer(editor))
      .send({ ...draft(), name: 'Piña Colada' })
      .expect(201);
    const second = await ctx
      .http()
      .post(`${API}/recipes`)
      .set(bearer(editor))
      .send({ ...draft(), name: 'Piña colada' })
      .expect(201);
    expect([first.body.slug, second.body.slug]).toEqual(['pina-colada', 'pina-colada-2']);
  });
});
