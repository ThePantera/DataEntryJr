import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Session, SessionStore } from '../../../../packages/client-core/src/api-client';
import { BartenderClient } from '../../../../packages/client-core/src/client';
import { openNodeDb } from '../../../../packages/client-core/src/node-sqlite';
import { buildCatalog } from '../../prisma/catalog';
import { seedDatabase } from '../../prisma/seed';
import {
  API,
  bearer,
  createTestApp,
  createUser,
  resetDatabase,
  type TestContext,
  type TestUser,
} from './helpers';

/**
 * End-to-end tests of the mobile app's offline-first core (packages/client-core) against the real
 * API over HTTP. Covers the mandatory tests the server alone cannot: offline operation, offline
 * download and reading, connection recovery, sync without duplicates and conflict resolution.
 */

class MemorySessions implements SessionStore {
  session: Session | null = null;
  async load() {
    return this.session;
  }
  async save(session: Session | null) {
    this.session = session;
  }
}

const catalog = buildCatalog();
const recipeId = (slug: string) => catalog.recipes.find((r) => r.slug === slug)!.id;
const ingredientId = (name: string) => catalog.ingredients.find((i) => i.name === name)!.id;
const UNREACHABLE = 'http://127.0.0.1:9';

describe('App offline-first contra la API real', () => {
  let ctx: TestContext;
  let serverUrl: string;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await ctx.app.listen(0, '127.0.0.1');
    serverUrl = `http://127.0.0.1:${(ctx.app.getHttpServer().address() as AddressInfo).port}`;
    await resetDatabase(ctx.prisma);
    await seedDatabase(ctx.prisma);
    admin = await createUser(ctx, 'ADMIN');
  });

  afterAll(() => ctx.app.close());

  async function device(options: { fetchImpl?: typeof fetch } = {}) {
    const client = await BartenderClient.open({
      db: openNodeDb(),
      bundle: catalog,
      sessions: new MemorySessions(),
      newId: randomUUID,
      fetchImpl: options.fetchImpl,
    });
    return client;
  }

  async function account() {
    const email = `movil-${randomUUID()}@example.com`;
    const password = 'una-contraseña-larga';
    await ctx
      .http()
      .post(`${API}/auth/register`)
      .send({ email, password, displayName: 'Móvil' })
      .expect(201);
    return { email, password };
  }

  async function onlineDevice(credentials: { email: string; password: string }) {
    const client = await device();
    await client.setServerUrl(serverUrl);
    await client.sync.login(credentials.email, credentials.password);
    return client;
  }

  const serverUserId = async (email: string) =>
    (await ctx.prisma.user.findUniqueOrThrow({ where: { email } })).id;

  it('works completely without a server: catalog, bar, favorites and matching', async () => {
    const client = await device();
    expect((await client.sync.sync()).status).toBe('not-configured');
    await client.favorites.add(recipeId('negroni'));
    for (const name of ['Gin', 'Campari', 'Vermut rojo'])
      await client.inventory.save({ ingredientId: ingredientId(name) });
    expect(
      (await client.catalog.match({ includeIncomplete: false })).map((m) => m.recipe.name),
    ).toEqual(['Negroni']);
    // 1 favorite + 3 bar items, queued until a server and an account exist.
    expect(await client.outbox.count()).toBe(4);
  });

  it('keeps local data and pending changes when the connection drops, then syncs once it returns', async () => {
    const credentials = await account();
    const client = await onlineDevice(credentials);
    expect((await client.sync.sync()).status).toBe('ok');

    // Connection lost: the user keeps using the app.
    await client.setServerUrl(UNREACHABLE);
    await client.favorites.add(recipeId('daiquiri'));
    await client.inventory.save({
      ingredientId: ingredientId('Ron blanco'),
      quantity: 700,
      unit: 'ML',
    });
    const offline = await client.sync.sync();
    expect(offline.status).toBe('offline');
    expect(await client.outbox.count()).toBe(2);
    expect(await client.catalog.listRecipes()).toHaveLength(7);
    expect(await client.favorites.isFavorite(recipeId('daiquiri'))).toBe(true);

    // Connection recovered.
    await client.setServerUrl(serverUrl);
    const online = await client.sync.sync();
    expect(online).toMatchObject({ status: 'ok', pushed: 2, conflicts: 0, rejected: 0 });
    expect(await client.outbox.count()).toBe(0);

    const userId = await serverUserId(credentials.email);
    expect(await ctx.prisma.favorite.count({ where: { userId, deletedAt: null } })).toBe(1);
    expect(await ctx.prisma.inventoryItem.count({ where: { userId, deletedAt: null } })).toBe(1);

    // Syncing again changes nothing.
    expect(await client.sync.sync()).toMatchObject({ status: 'ok', pushed: 0 });
    expect(await ctx.prisma.favorite.count({ where: { userId } })).toBe(1);
  });

  it('does not duplicate anything when the push response is lost and the queue is resent', async () => {
    const credentials = await account();
    let dropNextPushResponse = true;
    const flakyFetch: typeof fetch = async (input, init) => {
      const response = await fetch(input, init);
      if (String(input).endsWith('/sync/push') && dropNextPushResponse) {
        dropNextPushResponse = false;
        throw new TypeError('Network request failed'); // the server applied it, the phone never knew
      }
      return response;
    };
    const client = await device({ fetchImpl: flakyFetch });
    await client.setServerUrl(serverUrl);
    await client.sync.login(credentials.email, credentials.password);

    const listId = await client.shopping.create('Compras');
    await client.shopping.addItem(listId, ingredientId('Gin'), 1, 'UNIT');
    expect((await client.sync.sync()).status).toBe('offline');
    expect(await client.outbox.count()).toBe(2);

    expect((await client.sync.sync()).status).toBe('ok');
    const userId = await serverUserId(credentials.email);
    expect(await ctx.prisma.shoppingList.count({ where: { userId } })).toBe(1);
    expect(await ctx.prisma.shoppingListItem.count({ where: { shoppingListId: listId } })).toBe(1);
    expect(await ctx.prisma.syncOperation.count({ where: { userId, status: 'APPLIED' } })).toBe(2);
  });

  it('merges the same favorite added offline on two devices into one record', async () => {
    const credentials = await account();
    const phone = await onlineDevice(credentials);
    const tablet = await onlineDevice(credentials);
    await phone.favorites.add(recipeId('mojito'));
    await tablet.favorites.add(recipeId('mojito'));

    await phone.sync.sync();
    await tablet.sync.sync();
    const userId = await serverUserId(credentials.email);
    const favorites = await ctx.prisma.favorite.findMany({
      where: { userId, recipeId: recipeId('mojito') },
    });
    expect(favorites).toHaveLength(1);
    expect((await tablet.favorites.list()).map((f) => f.id)).toEqual([favorites[0].id]);
    expect((await phone.favorites.list()).map((f) => f.id)).toEqual([favorites[0].id]);
  });

  it('resolves concurrent edits with the server version and tells the user', async () => {
    const credentials = await account();
    const phone = await onlineDevice(credentials);
    const tablet = await onlineDevice(credentials);
    await phone.inventory.save({ ingredientId: ingredientId('Gin'), quantity: 700, unit: 'ML' });
    await phone.sync.sync();
    await tablet.sync.sync();
    expect((await tablet.inventory.list())[0]).toMatchObject({
      ingredientName: 'Gin',
      quantity: 700,
    });

    await phone.inventory.save({ ingredientId: ingredientId('Gin'), quantity: 500, unit: 'ML' });
    await phone.sync.sync();
    await tablet.inventory.save({ ingredientId: ingredientId('Gin'), quantity: 300, unit: 'ML' });
    const report = await tablet.sync.sync();

    expect(report).toMatchObject({ status: 'ok', conflicts: 1 });
    expect((await tablet.inventory.list())[0].quantity).toBe(500);
    expect((await tablet.sync.notices())[0].message).toContain('Conflicto');
    expect(await tablet.outbox.count()).toBe(0);
  });

  it('propagates deletions made on another device', async () => {
    const credentials = await account();
    const phone = await onlineDevice(credentials);
    const tablet = await onlineDevice(credentials);
    const listId = await phone.shopping.create('Fiesta');
    await phone.shopping.addItem(listId, ingredientId('Campari'));
    await phone.sync.sync();
    await tablet.sync.sync();
    expect((await tablet.shopping.lists()).map((l) => l.name)).toEqual(['Fiesta']);

    await phone.shopping.remove(listId);
    await phone.sync.sync();
    await tablet.sync.sync();
    expect(await tablet.shopping.lists()).toEqual([]);
  });

  it('flags an outdated local recipe and updates it on request', async () => {
    const client = await device();
    await client.setServerUrl(serverUrl);
    await client.sync.sync();
    await ctx
      .http()
      .patch(`${API}/recipes/${recipeId('negroni')}`)
      .set(bearer(admin))
      .send({ garnish: 'Piel de naranja' })
      .expect(200);

    const report = await client.sync.sync();
    expect(report.outdatedRecipes).toBe(1);
    expect((await client.catalog.listRecipes({ search: 'negroni' }))[0].outdated).toBe(true);

    expect(await client.sync.updateOutdatedRecipes()).toBe(1);
    const negroni = await client.catalog.getRecipe(recipeId('negroni'));
    expect(negroni).toMatchObject({ garnish: 'Piel de naranja', version: 2, outdated: false });
  });

  it('keeps a recipe withdrawn on the server available offline, flagged as withdrawn', async () => {
    const client = await device();
    await client.setServerUrl(serverUrl);
    await client.sync.sync();
    await ctx
      .http()
      .post(`${API}/recipes/${recipeId('margarita')}/status`)
      .set(bearer(admin))
      .send({ status: 'DRAFT' })
      .expect(200);

    await client.sync.sync();
    const margarita = await client.catalog.getRecipe(recipeId('margarita'));
    expect(margarita).toMatchObject({ name: 'Margarita', withdrawn: true });
    expect(margarita!.ingredients).toHaveLength(3);
    const all = await client.catalog.match({ ingredientIds: catalog.ingredients.map((i) => i.id) });
    expect(all.map((m) => m.recipe.name)).not.toContain('Margarita');
  });

  it('downloads a recipe published on the server and reads it offline afterwards', async () => {
    const created = await ctx
      .http()
      .post(`${API}/recipes`)
      .set(bearer(admin))
      .send({
        name: 'Gin Tonic de la casa',
        description: 'Gin y agua tónica.',
        difficulty: 'EASY',
        origin: 'ORIGINAL',
        techniqueId: catalog.techniques.find((t) => t.name === 'Directo')!.id,
        glasswareId: catalog.glassware.find((g) => g.name === 'Vaso highball')!.id,
        iceType: 'CUBED',
        ingredients: [
          { ingredientId: ingredientId('Gin'), quantity: 50, unit: 'ML' },
          { ingredientId: ingredientId('Agua con gas'), unit: 'TOP_UP' },
        ],
        steps: [
          { instruction: 'Servir el gin sobre hielo.' },
          { instruction: 'Completar con soda.' },
        ],
      })
      .expect(201);
    for (const status of ['REVIEW', 'VERIFIED', 'PUBLISHED']) {
      await ctx
        .http()
        .post(`${API}/recipes/${created.body.id}/status`)
        .set(bearer(admin))
        .send({ status })
        .expect(200);
    }

    const client = await device();
    await client.setServerUrl(serverUrl);
    const remote = await client.sync.listRemoteRecipes();
    expect(remote.find((r) => r.id === created.body.id)?.status).toBe('available');
    await client.sync.downloadRecipe(created.body.id);

    await client.setServerUrl(UNREACHABLE);
    expect((await client.sync.sync()).status).toBe('offline');
    const found = await client.catalog.listRecipes({ search: 'tonic' });
    expect(found).toEqual([
      expect.objectContaining({
        name: 'Gin Tonic de la casa',
        origin: 'ORIGINAL',
        isOfficialClassic: false,
      }),
    ]);
    const detail = await client.catalog.getRecipe(created.body.id, 2);
    expect(detail!.ingredients.map((i) => i.quantity)).toEqual([100, null]);
  });

  it('removes personal data from the device on logout but keeps the catalog', async () => {
    const credentials = await account();
    const client = await onlineDevice(credentials);
    await client.favorites.add(recipeId('americano'));
    await client.sync.sync();
    expect(await client.sync.logout()).toEqual({ unsyncedDiscarded: 0 });
    expect(await client.favorites.list()).toEqual([]);
    expect(await client.catalog.listRecipes()).toHaveLength(7);
  });
});
