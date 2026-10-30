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

describe('Catálogo: categorías, ingredientes, cristalería, equipamiento y técnicas', () => {
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

  describe('categories', () => {
    it('lists categories filtered by kind, without authentication', async () => {
      const res = await ctx.http().get(`${API}/categories?kind=INGREDIENT`).expect(200);
      expect(res.body.map((c: { name: string }) => c.name)).toEqual([
        'Destilados',
        'Modificadores',
      ]);
    });

    it('rejects an unknown kind', async () => {
      await ctx.http().get(`${API}/categories?kind=FOO`).expect(400);
    });
  });

  describe('ingredients', () => {
    it('lists ingredients with pagination and case-insensitive search', async () => {
      const res = await ctx.http().get(`${API}/ingredients?search=JUGO&pageSize=1`).expect(200);
      expect(res.body.total).toBe(2);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.page).toBe(1);
      expect(res.body.pageSize).toBe(1);
    });

    it('filters ingredients by category', async () => {
      const res = await ctx
        .http()
        .get(`${API}/ingredients?categoryId=${catalog.categories.spirits.id}&pageSize=100`)
        .expect(200);
      expect(res.body.items.map((i: { name: string }) => i.name)).toEqual([
        'Bourbon',
        'Gin',
        'Ron blanco',
        'Whiskey de centeno',
      ]);
    });

    it('returns one ingredient with numeric alcohol percentage and allergens', async () => {
      const res = await ctx
        .http()
        .get(`${API}/ingredients/${catalog.ingredients.sweetVermouth.id}`)
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Vermut rojo',
        alcoholPercentage: 16,
        allergens: ['SULPHITES'],
        category: { id: catalog.categories.modifiers.id, name: 'Modificadores' },
        version: 1,
      });
    });

    it('answers 404 for an unknown id and 400 for a malformed id', async () => {
      await ctx.http().get(`${API}/ingredients/${randomUUID()}`).expect(404);
      await ctx.http().get(`${API}/ingredients/not-a-uuid`).expect(400);
    });

    const newIngredient = () => ({
      name: 'Cointreau de prueba',
      categoryId: catalog.categories.modifiers.id,
      alcoholPercentage: 40,
      allergens: [],
    });

    it('does not let anonymous or common users create ingredients', async () => {
      await ctx.http().post(`${API}/ingredients`).send(newIngredient()).expect(401);
      await ctx
        .http()
        .post(`${API}/ingredients`)
        .set(bearer(user))
        .send(newIngredient())
        .expect(403);
    });

    it('lets editors create and update ingredients, bumping the version and the manifest', async () => {
      const created = await ctx
        .http()
        .post(`${API}/ingredients`)
        .set(bearer(editor))
        .send(newIngredient())
        .expect(201);
      expect(created.body.version).toBe(1);

      const updated = await ctx
        .http()
        .patch(`${API}/ingredients/${created.body.id}`)
        .set(bearer(editor))
        .send({ description: 'Licor de naranja', version: 1 })
        .expect(200);
      expect(updated.body).toMatchObject({ description: 'Licor de naranja', version: 2 });

      const manifest = await ctx.prisma.downloadManifest.findUniqueOrThrow({
        where: {
          resourceType_resourceId: { resourceType: 'INGREDIENT', resourceId: created.body.id },
        },
      });
      expect(manifest.version).toBe(2);
    });

    it('rejects an update based on an outdated version', async () => {
      await ctx
        .http()
        .patch(`${API}/ingredients/${catalog.ingredients.gin.id}`)
        .set(bearer(editor))
        .send({ description: 'x', version: 99 })
        .expect(409);
    });

    it('rejects duplicate names and unknown categories', async () => {
      await ctx
        .http()
        .post(`${API}/ingredients`)
        .set(bearer(editor))
        .send({ ...newIngredient(), name: 'Gin' })
        .expect(409);
      await ctx
        .http()
        .post(`${API}/ingredients`)
        .set(bearer(editor))
        .send({ ...newIngredient(), name: 'Otro', categoryId: randomUUID() })
        .expect(400);
    });

    it('validates alcohol percentage and allergens', async () => {
      await ctx
        .http()
        .post(`${API}/ingredients`)
        .set(bearer(editor))
        .send({ ...newIngredient(), name: 'Mal', alcoholPercentage: 120, allergens: ['PLUTONIUM'] })
        .expect(400);
    });
  });

  describe('glassware, equipment and techniques', () => {
    it('lists glassware and returns one item', async () => {
      const list = await ctx.http().get(`${API}/glassware`).expect(200);
      expect(list.body.map((g: { name: string }) => g.name)).toEqual([
        'Copa coupé',
        'Vaso old fashioned',
      ]);
      const one = await ctx
        .http()
        .get(`${API}/glassware/${catalog.glassware.coupe.id}`)
        .expect(200);
      expect(one.body).toMatchObject({ name: 'Copa coupé', capacityMl: 180 });
    });

    it('lists equipment', async () => {
      const res = await ctx.http().get(`${API}/equipment`).expect(200);
      expect(res.body).toHaveLength(3);
      await ctx.http().get(`${API}/equipment/${catalog.equipment.shaker.id}`).expect(200);
    });

    it('returns a technique with its equipment and common mistakes', async () => {
      const res = await ctx
        .http()
        .get(`${API}/techniques/${catalog.techniques.shake.id}`)
        .expect(200);
      expect(res.body).toMatchObject({
        name: 'Batido',
        durationSeconds: 12,
        commonMistakes: ['Agitar con poco hielo', 'Agitar demasiado tiempo'],
      });
      expect(res.body.equipment.map((e: { name: string }) => e.name)).toEqual([
        'Coctelera',
        'Colador Hawthorne',
      ]);
      const list = await ctx.http().get(`${API}/techniques`).expect(200);
      expect(list.body).toHaveLength(2);
    });
  });
});
