import { ingredientId, openClient, recipeId } from './helpers';

describe('cola de operaciones pendientes', () => {
  it('queues every local change with a client-generated UUID', async () => {
    const { client } = await openClient();
    await client.favorites.add(recipeId('negroni'));
    const [op] = await client.outbox.pending();
    expect(op).toMatchObject({ entityType: 'FAVORITE', action: 'UPSERT', baseVersion: null });
    expect(op.entityId).toMatch(/^[0-9a-f-]{36}$/);
    expect(op.payload).toEqual({ recipeId: recipeId('negroni') });
  });

  it('coalesces several edits of an unsynced record into one operation with the latest state', async () => {
    const { client } = await openClient();
    const id = await client.inventory.save({
      ingredientId: ingredientId('Gin'),
      quantity: 700,
      unit: 'ML',
    });
    await client.inventory.save({ ingredientId: ingredientId('Gin'), quantity: 350, unit: 'ML' });
    const ops = await client.outbox.pending();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ entityId: id, baseVersion: null, payload: { quantity: 350 } });
  });

  it('forgets a record created and deleted before it ever reached the server', async () => {
    const { client } = await openClient();
    await client.favorites.add(recipeId('negroni'));
    await client.favorites.remove(recipeId('negroni'));
    expect(await client.outbox.count()).toBe(0);
  });

  it('turns an edit followed by a delete of a synced record into a delete with the known version', async () => {
    const { client, db } = await openClient();
    const id = await client.inventory.save({ ingredientId: ingredientId('Gin') });
    await client.outbox.remove((await client.outbox.pending())[0].seq);
    await db.runAsync('UPDATE inventory SET version = 2 WHERE id = ?', id);

    await client.inventory.save({ ingredientId: ingredientId('Gin'), quantity: 1, unit: 'UNIT' });
    await client.inventory.remove(id);
    const ops = await client.outbox.pending();
    expect(ops).toEqual([
      expect.objectContaining({ action: 'DELETE', entityId: id, baseVersion: 2, payload: null }),
    ]);
  });

  it('keeps a delete when the create is already in flight, to rebase it after the answer', async () => {
    const { client } = await openClient();
    await client.favorites.add(recipeId('negroni'));
    const [create] = await client.outbox.pending();
    await client.outbox.markInFlight([create.seq]);
    await client.favorites.remove(recipeId('negroni'));

    const pending = await client.outbox.pending();
    expect(pending).toEqual([expect.objectContaining({ action: 'DELETE', baseVersion: null })]);
    await client.outbox.rebase('FAVORITE', create.entityId, 1);
    expect((await client.outbox.pending())[0].baseVersion).toBe(1);
  });

  it('returns sent-but-unanswered operations to the queue with the same opId', async () => {
    const { client } = await openClient();
    await client.favorites.add(recipeId('negroni'));
    const [op] = await client.outbox.pending();
    await client.outbox.markInFlight([op.seq]);
    expect(await client.outbox.pending()).toEqual([]);
    await client.outbox.resetInFlight();
    expect((await client.outbox.pending())[0].opId).toBe(op.opId);
  });
});

describe('listas de compras', () => {
  it('adds the missing ingredients of a recipe, scaled, skipping what is in the bar', async () => {
    const { client } = await openClient();
    await client.inventory.save({ ingredientId: ingredientId('Ron blanco') });
    const listId = await client.shopping.create('Para el sábado');
    expect(await client.shopping.addMissingFromRecipe(listId, recipeId('mojito'), 2)).toBe(4);
    const list = await client.shopping.getList(listId);
    expect(list!.items.map((i) => [i.ingredientName, i.quantity, i.unit])).toEqual([
      ['Agua con gas', null, null],
      ['Azúcar blanca de caña', 4, 'TEASPOON'],
      ['Jugo de lima', 40, 'ML'],
      ['Menta', 12, 'SPRIG'],
    ]);
  });

  it('ticks items and keeps counts', async () => {
    const { client } = await openClient();
    const listId = await client.shopping.create('Lista');
    await client.shopping.addItem(listId, ingredientId('Gin'));
    const [item] = (await client.shopping.getList(listId))!.items;
    await client.shopping.setCompleted(item.id, true);
    expect(await client.shopping.lists()).toEqual([
      expect.objectContaining({ name: 'Lista', itemCount: 1, completedCount: 1 }),
    ]);
  });

  it('dropping an unsynced list also drops the queued changes of its items', async () => {
    const { client } = await openClient();
    const listId = await client.shopping.create('Temporal');
    await client.shopping.addItem(listId, ingredientId('Gin'));
    await client.shopping.remove(listId);
    expect(await client.outbox.count()).toBe(0);
    expect(await client.shopping.lists()).toEqual([]);
  });
});
