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

type Op = {
  opId: string;
  entityType: 'FAVORITE' | 'INVENTORY' | 'SHOPPING_LIST' | 'SHOPPING_LIST_ITEM';
  action: 'UPSERT' | 'DELETE';
  entityId: string;
  baseVersion?: number | null;
  payload?: Record<string, unknown>;
};

const op = (partial: Omit<Op, 'opId'> & { opId?: string }): Op => ({
  opId: randomUUID(),
  ...partial,
});

describe('Sincronización', () => {
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

  const push = (user: TestUser, operations: Op[]) =>
    ctx.http().post(`${API}/sync/push`).set(bearer(user)).send({ operations });

  describe('GET /sync/manifest', () => {
    it('lists the version of every public resource without authentication', async () => {
      const res = await ctx.http().get(`${API}/sync/manifest`).expect(200);
      const recipes = res.body.entries.filter(
        (e: { resourceType: string }) => e.resourceType === 'RECIPE',
      );
      expect(recipes).toHaveLength(4);
      expect(recipes.map((e: { resourceId: string }) => e.resourceId)).not.toContain(
        catalog.recipes.manhattan.id,
      );
      expect(res.body.entries).toHaveLength(4 + 13 + 2 + 2 + 3 + 4);
      expect(res.body.entries[0]).toEqual({
        resourceType: expect.any(String),
        resourceId: expect.any(String),
        version: 1,
        deleted: false,
        updatedAt: expect.any(String),
      });
    });

    it('filters by resource type', async () => {
      const res = await ctx.http().get(`${API}/sync/manifest?types=RECIPE,TECHNIQUE`).expect(200);
      expect(res.body.entries).toHaveLength(6);
      await ctx.http().get(`${API}/sync/manifest?types=RECIPE,POTION`).expect(400);
    });
  });

  describe('GET /sync/changes', () => {
    it('returns public content changes since a cursor and tells which local recipes are outdated', async () => {
      // Pretend the catalog was published an hour ago (outside the cursor safety window).
      await ctx.prisma.downloadManifest.updateMany({
        data: { updatedAt: new Date(Date.now() - 3_600_000) },
      });
      const first = await ctx.http().get(`${API}/sync/changes`).expect(200);
      expect(first.body.content.length).toBe(28);
      expect(first.body.user).toBeNull();

      const admin = await createUser(ctx, 'ADMIN');
      await ctx
        .http()
        .patch(`${API}/recipes/${catalog.recipes.negroni.id}`)
        .set(bearer(admin))
        .send({ garnish: 'Media rodaja de naranja' })
        .expect(200);

      const next = await ctx
        .http()
        .get(`${API}/sync/changes?since=${first.body.nextSince}`)
        .expect(200);
      expect(next.body.content).toEqual([
        expect.objectContaining({
          resourceType: 'RECIPE',
          resourceId: catalog.recipes.negroni.id,
          version: 2,
        }),
      ]);
    });

    it('rejects a malformed cursor', async () => {
      await ctx.http().get(`${API}/sync/changes?since=yesterday`).expect(400);
    });
  });

  describe('POST /sync/push', () => {
    it('requires authentication', async () => {
      await ctx.http().post(`${API}/sync/push`).send({ operations: [] }).expect(401);
    });

    it('applies operations created offline with client-generated ids', async () => {
      const listId = randomUUID();
      const operations = [
        op({
          entityType: 'FAVORITE',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { recipeId: catalog.recipes.daiquiri.id },
        }),
        op({
          entityType: 'INVENTORY',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { ingredientId: catalog.ingredients.gin.id, quantity: 700, unit: 'ML' },
        }),
        op({
          entityType: 'SHOPPING_LIST',
          action: 'UPSERT',
          entityId: listId,
          payload: { name: 'Offline' },
        }),
        op({
          entityType: 'SHOPPING_LIST_ITEM',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: {
            shoppingListId: listId,
            ingredientId: catalog.ingredients.campari.id,
            quantity: 1,
            unit: 'UNIT',
          },
        }),
      ];
      const res = await push(ana, operations).expect(200);
      expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
        'APPLIED',
        'APPLIED',
        'APPLIED',
        'APPLIED',
      ]);
      res.body.results.forEach((r: { entity: { id: string; version: number } }, i: number) => {
        expect(r.entity).toMatchObject({ id: operations[i].entityId, version: 1 });
      });
    });

    it('does not duplicate anything when the same batch is retried after a lost response', async () => {
      const operations = [
        op({
          entityType: 'SHOPPING_LIST',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { name: 'Reintento' },
        }),
        op({
          entityType: 'INVENTORY',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { ingredientId: catalog.ingredients.limeJuice.id },
        }),
      ];
      const first = await push(ana, operations).expect(200);
      const before = await countUserRows(ana.id);
      const retry = await push(ana, operations).expect(200);

      expect(retry.body.results.map((r: { replayed: boolean }) => r.replayed)).toEqual([
        true,
        true,
      ]);
      expect(retry.body.results.map((r: { status: string }) => r.status)).toEqual(
        first.body.results.map((r: { status: string }) => r.status),
      );
      expect(await countUserRows(ana.id)).toEqual(before);
    });

    it('handles the same operation arriving twice concurrently without duplicating it', async () => {
      const operations = [
        op({
          entityType: 'SHOPPING_LIST',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { name: 'Carrera' },
        }),
      ];
      const [a, b] = await Promise.all([push(ana, operations), push(ana, operations)]);
      expect([a.status, b.status]).toEqual([200, 200]);
      const replayed = [a.body.results[0].replayed, b.body.results[0].replayed].sort();
      expect(replayed).toEqual([false, true]);
      expect(await ctx.prisma.shoppingList.count({ where: { id: operations[0].entityId } })).toBe(
        1,
      );
    });

    it('merges a favorite created on two devices into a single record', async () => {
      const recipeId = catalog.recipes.negroni.id;
      const phone = await push(ana, [
        op({
          entityType: 'FAVORITE',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { recipeId },
        }),
      ]).expect(200);
      const tablet = await push(ana, [
        op({
          entityType: 'FAVORITE',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { recipeId },
        }),
      ]).expect(200);

      expect(tablet.body.results[0]).toMatchObject({
        status: 'MERGED',
        canonicalId: phone.body.results[0].entity.id,
      });
      expect(await ctx.prisma.favorite.count({ where: { userId: ana.id, recipeId } })).toBe(1);
    });

    it('keeps one inventory entry per ingredient when two devices add it offline (server wins)', async () => {
      const ingredientId = catalog.ingredients.campari.id;
      const first = await push(ana, [
        op({
          entityType: 'INVENTORY',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { ingredientId, quantity: 1, unit: 'UNIT' },
        }),
      ]).expect(200);
      const second = await push(ana, [
        op({
          entityType: 'INVENTORY',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { ingredientId, quantity: 2, unit: 'UNIT' },
        }),
      ]).expect(200);

      expect(second.body.results[0]).toMatchObject({
        status: 'CONFLICT',
        reason: 'DUPLICATE',
        canonicalId: first.body.results[0].entity.id,
        entity: expect.objectContaining({ quantity: 1 }),
      });
      expect(
        await ctx.prisma.inventoryItem.count({ where: { userId: ana.id, ingredientId } }),
      ).toBe(1);
    });

    describe('conflictos de versión', () => {
      let itemId: string;

      beforeAll(async () => {
        itemId = randomUUID();
        await push(ana, [
          op({
            entityType: 'INVENTORY',
            action: 'UPSERT',
            entityId: itemId,
            payload: { ingredientId: catalog.ingredients.angostura.id, quantity: 200, unit: 'ML' },
          }),
        ]).expect(200);
      });

      const update = (baseVersion: number, quantity: number) =>
        op({
          entityType: 'INVENTORY',
          action: 'UPSERT',
          entityId: itemId,
          baseVersion,
          payload: { ingredientId: catalog.ingredients.angostura.id, quantity, unit: 'ML' },
        });

      it('applies an edit made on the current version', async () => {
        const res = await push(ana, [update(1, 150)]).expect(200);
        expect(res.body.results[0]).toMatchObject({
          status: 'APPLIED',
          entity: { quantity: 150, version: 2 },
        });
      });

      it('rejects an edit made on an outdated version and returns the server copy', async () => {
        const res = await push(ana, [update(1, 50)]).expect(200);
        expect(res.body.results[0]).toMatchObject({
          status: 'CONFLICT',
          reason: 'STALE_VERSION',
          entity: { quantity: 150, version: 2 },
        });
      });

      it('keeps the newer edit when an outdated delete arrives', async () => {
        const res = await push(ana, [
          op({ entityType: 'INVENTORY', action: 'DELETE', entityId: itemId, baseVersion: 1 }),
        ]).expect(200);
        expect(res.body.results[0]).toMatchObject({ status: 'CONFLICT', reason: 'STALE_VERSION' });
        const row = await ctx.prisma.inventoryItem.findUniqueOrThrow({ where: { id: itemId } });
        expect(row.deletedAt).toBeNull();
      });

      it('lets a deletion win over a later edit based on the deleted version', async () => {
        const del = await push(ana, [
          op({ entityType: 'INVENTORY', action: 'DELETE', entityId: itemId, baseVersion: 2 }),
        ]).expect(200);
        expect(del.body.results[0]).toMatchObject({ status: 'APPLIED', entity: { version: 3 } });
        expect(del.body.results[0].entity.deletedAt).toEqual(expect.any(String));

        const edit = await push(ana, [update(2, 10)]).expect(200);
        expect(edit.body.results[0]).toMatchObject({
          status: 'CONFLICT',
          reason: 'DELETED_ON_SERVER',
        });
      });

      it('treats deleting an already deleted or unknown record as done', async () => {
        const res = await push(ana, [
          op({ entityType: 'INVENTORY', action: 'DELETE', entityId: itemId, baseVersion: 3 }),
          op({ entityType: 'INVENTORY', action: 'DELETE', entityId: randomUUID(), baseVersion: 1 }),
        ]).expect(200);
        expect(res.body.results.map((r: { status: string }) => r.status)).toEqual([
          'APPLIED',
          'APPLIED',
        ]);
      });
    });

    it("never lets a user touch another user's records", async () => {
      const anaList = randomUUID();
      await push(ana, [
        op({
          entityType: 'SHOPPING_LIST',
          action: 'UPSERT',
          entityId: anaList,
          payload: { name: 'De Ana' },
        }),
      ]).expect(200);

      const res = await push(bruno, [
        op({
          entityType: 'SHOPPING_LIST',
          action: 'UPSERT',
          entityId: anaList,
          baseVersion: 1,
          payload: { name: 'Robada' },
        }),
        op({ entityType: 'SHOPPING_LIST', action: 'DELETE', entityId: anaList, baseVersion: 1 }),
        op({
          entityType: 'SHOPPING_LIST_ITEM',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { shoppingListId: anaList, ingredientId: catalog.ingredients.gin.id },
        }),
      ]).expect(200);
      expect(
        res.body.results.map((r: { status: string; reason: string }) => [r.status, r.reason]),
      ).toEqual([
        ['REJECTED', 'NOT_FOUND'],
        ['REJECTED', 'NOT_FOUND'],
        ['REJECTED', 'NOT_FOUND'],
      ]);
      const list = await ctx.prisma.shoppingList.findUniqueOrThrow({ where: { id: anaList } });
      expect(list).toMatchObject({ name: 'De Ana', deletedAt: null, version: 1 });
    });

    it('rejects invalid operations individually without blocking the rest of the batch', async () => {
      const res = await push(ana, [
        op({
          entityType: 'INVENTORY',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { ingredientId: 'nope' },
        }),
        op({
          entityType: 'FAVORITE',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { recipeId: catalog.recipes.manhattan.id },
        }),
        op({
          entityType: 'SHOPPING_LIST',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { name: 'Válida' },
        }),
      ]).expect(200);
      expect(
        res.body.results.map((r: { status: string; reason?: string }) => [
          r.status,
          r.reason ?? null,
        ]),
      ).toEqual([
        ['REJECTED', 'INVALID_PAYLOAD'],
        ['REJECTED', 'RECIPE_NOT_AVAILABLE'],
        ['APPLIED', null],
      ]);
    });

    it('validates the batch envelope', async () => {
      await push(ana, [
        { opId: 'x', entityType: 'FAVORITE', action: 'UPSERT', entityId: randomUUID() } as Op,
      ]).expect(400);
      const tooMany = Array.from({ length: 101 }, () =>
        op({
          entityType: 'SHOPPING_LIST',
          action: 'UPSERT',
          entityId: randomUUID(),
          payload: { name: 'x' },
        }),
      );
      await push(ana, tooMany).expect(400);
    });
  });

  describe('changes for the authenticated user', () => {
    it("includes the user's own records and tombstones, and nothing from other users", async () => {
      const res = await ctx.http().get(`${API}/sync/changes`).set(bearer(ana)).expect(200);
      const user = res.body.user;
      expect(user.favorites.length).toBeGreaterThan(0);
      expect(user.inventory.some((i: { deletedAt: string | null }) => i.deletedAt !== null)).toBe(
        true,
      );
      expect(user.shoppingLists.map((l: { name: string }) => l.name)).toEqual(
        expect.arrayContaining(['Offline', 'Reintento', 'De Ana']),
      );
      expect(user.shoppingListItems).toHaveLength(1);

      const brunoChanges = await ctx
        .http()
        .get(`${API}/sync/changes`)
        .set(bearer(bruno))
        .expect(200);
      expect(brunoChanges.body.user).toEqual({
        favorites: [],
        inventory: [],
        shoppingLists: [],
        shoppingListItems: [],
      });
    });
  });

  async function countUserRows(userId: string) {
    const [favorites, inventory, lists] = await Promise.all([
      ctx.prisma.favorite.count({ where: { userId } }),
      ctx.prisma.inventoryItem.count({ where: { userId } }),
      ctx.prisma.shoppingList.count({ where: { userId } }),
    ]);
    return { favorites, inventory, lists };
  }
});
