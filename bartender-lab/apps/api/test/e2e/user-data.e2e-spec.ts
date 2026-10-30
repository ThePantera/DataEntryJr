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

describe('Datos del usuario: inventario, favoritos y listas de compras', () => {
  let ctx: TestContext;
  let catalog: Catalog;
  let ana: TestUser;
  let bruno: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    catalog = await seedCatalog(ctx);
    ana = await createUser(ctx);
    bruno = await createUser(ctx);
  });

  afterAll(() => ctx.app.close());

  describe('inventory (Mi barra)', () => {
    it('requires authentication', async () => {
      await ctx.http().get(`${API}/inventory`).expect(401);
    });

    it('adds, lists, updates and deletes inventory items', async () => {
      const created = await ctx
        .http()
        .post(`${API}/inventory`)
        .set(bearer(ana))
        .send({
          ingredientId: catalog.ingredients.gin.id,
          quantity: 700,
          unit: 'ML',
          expirationDate: '2027-12-31',
        })
        .expect(201);
      expect(created.body).toMatchObject({
        ingredientName: 'Gin',
        quantity: 700,
        unit: 'ML',
        expirationDate: '2027-12-31',
        version: 1,
        deletedAt: null,
      });

      const list = await ctx.http().get(`${API}/inventory`).set(bearer(ana)).expect(200);
      expect(list.body.map((i: { ingredientName: string }) => i.ingredientName)).toEqual(['Gin']);

      const updated = await ctx
        .http()
        .patch(`${API}/inventory/${created.body.id}`)
        .set(bearer(ana))
        .send({ quantity: 350, version: 1 })
        .expect(200);
      expect(updated.body).toMatchObject({ quantity: 350, version: 2 });

      await ctx.http().delete(`${API}/inventory/${created.body.id}`).set(bearer(ana)).expect(204);
      const after = await ctx.http().get(`${API}/inventory`).set(bearer(ana)).expect(200);
      expect(after.body).toEqual([]);

      const tombstone = await ctx.prisma.inventoryItem.findUniqueOrThrow({
        where: { id: created.body.id },
      });
      expect(tombstone.deletedAt).not.toBeNull();
      expect(tombstone.version).toBe(3);
    });

    it('accepts a client-generated UUID and revives a deleted entry for the same ingredient', async () => {
      const id = randomUUID();
      const created = await ctx
        .http()
        .post(`${API}/inventory`)
        .set(bearer(ana))
        .send({ id, ingredientId: catalog.ingredients.campari.id })
        .expect(201);
      expect(created.body.id).toBe(id);
      await ctx.http().delete(`${API}/inventory/${id}`).set(bearer(ana)).expect(204);

      const revived = await ctx
        .http()
        .post(`${API}/inventory`)
        .set(bearer(ana))
        .send({ ingredientId: catalog.ingredients.campari.id, quantity: 1, unit: 'UNIT' })
        .expect(201);
      expect(revived.body).toMatchObject({ id, quantity: 1, deletedAt: null });
    });

    it('rejects a second live entry for the same ingredient', async () => {
      await ctx
        .http()
        .post(`${API}/inventory`)
        .set(bearer(ana))
        .send({ ingredientId: catalog.ingredients.campari.id })
        .expect(409);
    });

    it('rejects stale versions, unknown ingredients and invalid data', async () => {
      const item = await ctx
        .http()
        .post(`${API}/inventory`)
        .set(bearer(ana))
        .send({ ingredientId: catalog.ingredients.limeJuice.id })
        .expect(201);
      await ctx
        .http()
        .patch(`${API}/inventory/${item.body.id}`)
        .set(bearer(ana))
        .send({ quantity: 1, version: 5 })
        .expect(409);
      await ctx
        .http()
        .post(`${API}/inventory`)
        .set(bearer(ana))
        .send({ ingredientId: randomUUID() })
        .expect(400);
      await ctx
        .http()
        .post(`${API}/inventory`)
        .set(bearer(ana))
        .send({
          ingredientId: catalog.ingredients.soda.id,
          quantity: -1,
          expirationDate: '31/12/2027',
        })
        .expect(400);
    });

    it("never exposes or modifies another user's inventory", async () => {
      const mine = await ctx.http().get(`${API}/inventory`).set(bearer(ana)).expect(200);
      const someId = mine.body[0].id;

      const theirs = await ctx.http().get(`${API}/inventory`).set(bearer(bruno)).expect(200);
      expect(theirs.body).toEqual([]);
      await ctx
        .http()
        .patch(`${API}/inventory/${someId}`)
        .set(bearer(bruno))
        .send({ quantity: 0 })
        .expect(404);
      await ctx.http().delete(`${API}/inventory/${someId}`).set(bearer(bruno)).expect(404);
    });

    it('feeds the matching engine with the stored inventory', async () => {
      // Ana has Campari and lime juice; adding the rest of a Daiquiri makes it an exact match.
      for (const ingredientId of [
        catalog.ingredients.whiteRum.id,
        catalog.ingredients.simpleSyrup.id,
      ]) {
        await ctx
          .http()
          .post(`${API}/inventory`)
          .set(bearer(ana))
          .send({ ingredientId })
          .expect(201);
      }
      const res = await ctx
        .http()
        .post(`${API}/recipes/match`)
        .set(bearer(ana))
        .send({ useInventory: true, includeIncomplete: false })
        .expect(200);
      expect(res.body.results.map((r: { recipeName: string }) => r.recipeName)).toEqual([
        'Daiquiri',
      ]);
    });

    it('treats an inventory item with quantity 0 as not available', async () => {
      const list = await ctx.http().get(`${API}/inventory`).set(bearer(ana)).expect(200);
      const rum = list.body.find(
        (i: { ingredientName: string }) => i.ingredientName === 'Ron blanco',
      );
      await ctx
        .http()
        .patch(`${API}/inventory/${rum.id}`)
        .set(bearer(ana))
        .send({ quantity: 0, unit: 'ML' })
        .expect(200);
      const res = await ctx
        .http()
        .post(`${API}/recipes/match`)
        .set(bearer(ana))
        .send({ useInventory: true, includeIncomplete: false })
        .expect(200);
      expect(res.body.results).toEqual([]);
    });
  });

  describe('favorites', () => {
    it('adds favorites idempotently and lists them with the recipe', async () => {
      const recipeId = catalog.recipes.negroni.id;
      const first = await ctx
        .http()
        .post(`${API}/favorites/${recipeId}`)
        .set(bearer(ana))
        .expect(201);
      const again = await ctx
        .http()
        .post(`${API}/favorites/${recipeId}`)
        .set(bearer(ana))
        .expect(201);
      expect(again.body.id).toBe(first.body.id);

      const list = await ctx.http().get(`${API}/favorites`).set(bearer(ana)).expect(200);
      expect(list.body).toEqual([
        expect.objectContaining({
          recipeId,
          recipeAvailable: true,
          recipe: expect.objectContaining({ name: 'Negroni' }),
        }),
      ]);
    });

    it('cannot favorite an unpublished or unknown recipe', async () => {
      await ctx
        .http()
        .post(`${API}/favorites/${catalog.recipes.manhattan.id}`)
        .set(bearer(ana))
        .expect(404);
      await ctx.http().post(`${API}/favorites/${randomUUID()}`).set(bearer(ana)).expect(404);
    });

    it('removes favorites idempotently, keeping a tombstone for sync', async () => {
      const recipeId = catalog.recipes.negroni.id;
      await ctx.http().delete(`${API}/favorites/${recipeId}`).set(bearer(ana)).expect(204);
      await ctx.http().delete(`${API}/favorites/${recipeId}`).set(bearer(ana)).expect(204);
      const list = await ctx.http().get(`${API}/favorites`).set(bearer(ana)).expect(200);
      expect(list.body).toEqual([]);

      const row = await ctx.prisma.favorite.findFirstOrThrow({
        where: { recipeId, userId: ana.id },
      });
      expect(row.deletedAt).not.toBeNull();
    });

    it('keeps favorites private to each user', async () => {
      await ctx
        .http()
        .post(`${API}/favorites/${catalog.recipes.daiquiri.id}`)
        .set(bearer(bruno))
        .expect(201);
      const brunos = await ctx.http().get(`${API}/favorites`).set(bearer(bruno)).expect(200);
      expect(brunos.body).toHaveLength(1);
      const stranger = await createUser(ctx);
      const other = await ctx.http().get(`${API}/favorites`).set(bearer(stranger)).expect(200);
      expect(other.body).toEqual([]);
    });
  });

  describe('shopping lists', () => {
    it('creates a list, adds items, ticks them and deletes the list', async () => {
      const list = await ctx
        .http()
        .post(`${API}/shopping-lists`)
        .set(bearer(ana))
        .send({ name: 'Para el sábado' })
        .expect(201);
      const listId = list.body.id;

      const item = await ctx
        .http()
        .post(`${API}/shopping-lists/${listId}/items`)
        .set(bearer(ana))
        .send({ ingredientId: catalog.ingredients.gin.id, quantity: 1, unit: 'UNIT' })
        .expect(201);
      await ctx
        .http()
        .post(`${API}/shopping-lists/${listId}/items`)
        .set(bearer(ana))
        .send({ ingredientId: catalog.ingredients.gin.id })
        .expect(409);

      const ticked = await ctx
        .http()
        .patch(`${API}/shopping-lists/${listId}/items/${item.body.id}`)
        .set(bearer(ana))
        .send({ completed: true, version: 1 })
        .expect(200);
      expect(ticked.body).toMatchObject({ completed: true, version: 2, ingredientName: 'Gin' });

      const detail = await ctx
        .http()
        .get(`${API}/shopping-lists/${listId}`)
        .set(bearer(ana))
        .expect(200);
      expect(detail.body).toMatchObject({
        name: 'Para el sábado',
        items: [expect.objectContaining({ completed: true })],
      });

      const overview = await ctx.http().get(`${API}/shopping-lists`).set(bearer(ana)).expect(200);
      expect(overview.body).toEqual([
        expect.objectContaining({ id: listId, itemCount: 1, completedCount: 1 }),
      ]);

      await ctx.http().delete(`${API}/shopping-lists/${listId}`).set(bearer(ana)).expect(204);
      await ctx.http().get(`${API}/shopping-lists/${listId}`).set(bearer(ana)).expect(404);
      const itemRow = await ctx.prisma.shoppingListItem.findUniqueOrThrow({
        where: { id: item.body.id },
      });
      expect(itemRow.deletedAt).not.toBeNull();
    });

    it("keeps lists private and rejects items on another user's list", async () => {
      const list = await ctx
        .http()
        .post(`${API}/shopping-lists`)
        .set(bearer(ana))
        .send({ name: 'Privada' })
        .expect(201);
      await ctx.http().get(`${API}/shopping-lists/${list.body.id}`).set(bearer(bruno)).expect(404);
      await ctx
        .http()
        .post(`${API}/shopping-lists/${list.body.id}/items`)
        .set(bearer(bruno))
        .send({ ingredientId: catalog.ingredients.gin.id })
        .expect(404);
      await ctx
        .http()
        .patch(`${API}/shopping-lists/${list.body.id}`)
        .set(bearer(bruno))
        .send({ name: 'Hackeada' })
        .expect(404);
    });

    it('validates names', async () => {
      await ctx
        .http()
        .post(`${API}/shopping-lists`)
        .set(bearer(ana))
        .send({ name: '' })
        .expect(400);
    });
  });
});
