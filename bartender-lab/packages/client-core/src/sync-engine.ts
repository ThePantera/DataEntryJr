import type { CatalogRecipe, Unit } from '@bartender-lab/shared';
import {
  ApiError,
  NotConfiguredError,
  OfflineError,
  SessionExpiredError,
  type ApiClient,
  type Session,
} from './api-client';
import type {
  ApiCategory,
  ApiChanges,
  ApiEquipment,
  ApiFavorite,
  ApiGlassware,
  ApiIngredient,
  ApiInventoryItem,
  ApiPage,
  ApiPushResult,
  ApiRecipeDetail,
  ApiRecipeSummary,
  ApiShoppingList,
  ApiShoppingListItem,
  ApiSubstitution,
  ApiTechnique,
} from './api-types';
import {
  replaceSubstitutions,
  upsertCategory,
  upsertEquipment,
  upsertGlassware,
  upsertIngredient,
  upsertRecipe,
  upsertTechnique,
} from './catalog-store';
import { fromBool, inTransaction, nowIso, type Db } from './db';
import type { EntityType, Outbox, OutboxOp } from './outbox';
import { getMeta, setMeta } from './schema';

export type SyncStatus = 'ok' | 'offline' | 'not-configured' | 'session-expired' | 'error';

export interface SyncReport {
  status: SyncStatus;
  pushed: number;
  conflicts: number;
  rejected: number;
  userChanges: number;
  contentChanges: number;
  outdatedRecipes: number;
  message?: string;
}

export type RemoteRecipeStatus = 'available' | 'downloaded' | 'outdated';

export interface RemoteRecipe {
  id: string;
  name: string;
  description: string;
  version: number;
  status: RemoteRecipeStatus;
}

export interface SyncNotice {
  id: number;
  createdAt: string;
  message: string;
}

const CURSOR_KEY = 'sync_cursor';
const LAST_SYNC_KEY = 'last_sync_at';
const CATALOG_TYPES = ['CATEGORY', 'INGREDIENT', 'GLASSWARE', 'EQUIPMENT', 'TECHNIQUE'];

const TABLE: Record<EntityType, string> = {
  FAVORITE: 'favorites',
  INVENTORY: 'inventory',
  SHOPPING_LIST: 'shopping_lists',
  SHOPPING_LIST_ITEM: 'shopping_list_items',
};

const LABEL: Record<EntityType, string> = {
  FAVORITE: 'un favorito',
  INVENTORY: 'un ingrediente de Mi barra',
  SHOPPING_LIST: 'una lista de compras',
  SHOPPING_LIST_ITEM: 'un ítem de la lista de compras',
};

const emptyReport = (status: SyncStatus, message?: string): SyncReport => ({
  status,
  pushed: 0,
  conflicts: 0,
  rejected: 0,
  userChanges: 0,
  contentChanges: 0,
  outdatedRecipes: 0,
  ...(message ? { message } : {}),
});

/**
 * Offline-first synchronisation (protocol in docs/adr/0005-sincronizacion.md).
 * Order: push the local queue, then pull changes. Any network failure leaves local data and the
 * queue intact; the next sync resumes with the same opIds, so nothing is applied twice.
 */
export class SyncEngine {
  private running: Promise<SyncReport> | null = null;

  constructor(
    private readonly db: Db,
    private readonly api: ApiClient,
    private readonly outbox: Outbox,
  ) {}

  /** Single-flight: concurrent calls share the same run. */
  sync(): Promise<SyncReport> {
    this.running ??= this.run().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  async lastSyncAt(): Promise<string | null> {
    return getMeta(this.db, LAST_SYNC_KEY);
  }

  async login(email: string, password: string): Promise<Session> {
    const session = await this.api.login(email, password);
    await setMeta(this.db, CURSOR_KEY, null);
    return session;
  }

  async register(email: string, password: string, displayName: string): Promise<Session> {
    const session = await this.api.register(email, password, displayName);
    await setMeta(this.db, CURSOR_KEY, null);
    return session;
  }

  /**
   * Tries to send pending changes first; then ends the session and removes this account's
   * personal data from the device (the catalog and downloaded recipes stay).
   */
  async logout(): Promise<{ unsyncedDiscarded: number }> {
    if ((await this.outbox.count()) > 0) await this.sync();
    const unsyncedDiscarded = await this.outbox.count();
    await this.api.logout();
    await inTransaction(this.db, async () => {
      for (const table of [
        'outbox',
        'favorites',
        'inventory',
        'shopping_list_items',
        'shopping_lists',
      ]) {
        await this.db.runAsync(`DELETE FROM ${table}`);
      }
      await setMeta(this.db, CURSOR_KEY, null);
    });
    return { unsyncedDiscarded };
  }

  async notices(limit = 20): Promise<SyncNotice[]> {
    const rows = await this.db.getAllAsync<{ id: number; created_at: string; message: string }>(
      'SELECT id, created_at, message FROM sync_notices ORDER BY id DESC LIMIT ?',
      limit,
    );
    return rows.map((r) => ({ id: r.id, createdAt: r.created_at, message: r.message }));
  }

  async clearNotices(): Promise<void> {
    await this.db.runAsync('DELETE FROM sync_notices');
  }

  async outdatedRecipeIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT r.id FROM recipes r JOIN remote_manifest m
         ON m.resource_type = 'RECIPE' AND m.resource_id = r.id AND m.deleted = 0
       WHERE m.version > r.version`,
    );
    return rows.map((r) => r.id);
  }

  /** Published recipes on the server and whether this device has them (Descargas screen). */
  async listRemoteRecipes(): Promise<RemoteRecipe[]> {
    const local = new Map(
      (
        await this.db.getAllAsync<{ id: string; version: number }>(
          'SELECT id, version FROM recipes',
        )
      ).map((r) => [r.id, r.version]),
    );
    const result: RemoteRecipe[] = [];
    for (let page = 1; ; page += 1) {
      const res = await this.api.request<ApiPage<ApiRecipeSummary>>(
        'GET',
        `/recipes?page=${page}&pageSize=100`,
      );
      for (const r of res.items) {
        const localVersion = local.get(r.id);
        result.push({
          id: r.id,
          name: r.name,
          description: r.description,
          version: r.version,
          status:
            localVersion === undefined
              ? 'available'
              : localVersion < r.version
                ? 'outdated'
                : 'downloaded',
        });
      }
      if (page * res.pageSize >= res.total) break;
    }
    return result;
  }

  /** Downloads (or updates) one recipe and everything it references, for offline use. */
  async downloadRecipe(id: string): Promise<void> {
    const recipe = await this.api.request<ApiRecipeDetail>('GET', `/recipes/${id}`);
    await this.ensureCatalogFor(recipe);
    const catalogRecipe: CatalogRecipe = {
      id: recipe.id,
      name: recipe.name,
      slug: recipe.slug,
      description: recipe.description,
      history: recipe.history,
      difficulty: recipe.difficulty,
      preparationTimeSeconds: recipe.preparationTimeSeconds,
      servings: recipe.baseServings,
      glasswareId: recipe.glassware?.id ?? null,
      techniqueId: recipe.technique?.id ?? null,
      iceType: recipe.iceType,
      garnish: recipe.garnish,
      alcoholPercentageEstimated: recipe.alcoholPercentageEstimated,
      instructions: recipe.instructions,
      imageUrl: recipe.imageUrl,
      source: recipe.source,
      origin: recipe.origin,
      version: recipe.version,
      categoryIds: recipe.categories.map((c) => c.id),
      ingredients: recipe.ingredients.map((i) => ({
        id: i.id,
        ingredientId: i.ingredientId,
        quantity: i.quantity,
        unit: i.unit,
        optional: i.optional,
        position: i.position,
      })),
      steps: recipe.steps.map((s) => ({
        id: s.id,
        stepNumber: s.stepNumber,
        instruction: s.instruction,
        durationSeconds: s.durationSeconds,
        imageUrl: s.imageUrl,
      })),
    };
    await inTransaction(this.db, async () => {
      await upsertRecipe(this.db, catalogRecipe, 'download');
    });
  }

  async updateOutdatedRecipes(): Promise<number> {
    const ids = await this.outdatedRecipeIds();
    for (const id of ids) await this.downloadRecipe(id);
    return ids.length;
  }

  // ─── internals ────────────────────────────────────────────────────────────

  private async run(): Promise<SyncReport> {
    if (!(await this.api.isConfigured())) return emptyReport('not-configured');
    const report = emptyReport('ok');
    try {
      const loggedIn = (await this.api.sessions.load()) !== null;
      if (loggedIn) await this.push(report);
      await this.pull(report, loggedIn);
      report.outdatedRecipes = (await this.outdatedRecipeIds()).length;
      await setMeta(this.db, LAST_SYNC_KEY, nowIso());
      return report;
    } catch (error) {
      await this.outbox.resetInFlight();
      // Compared by name too: transpiled subclasses of Error may lose their prototype chain.
      const name = error instanceof Error ? error.name : '';
      const message = error instanceof Error ? error.message : undefined;
      if (error instanceof OfflineError || name === 'OfflineError')
        return { ...report, status: 'offline', message };
      if (error instanceof NotConfiguredError || name === 'NotConfiguredError')
        return emptyReport('not-configured');
      if (error instanceof SessionExpiredError || name === 'SessionExpiredError') {
        return { ...report, status: 'session-expired', message };
      }
      if (error instanceof ApiError || name === 'ApiError')
        return { ...report, status: 'error', message };
      throw error;
    }
  }

  private async push(report: SyncReport): Promise<void> {
    await this.outbox.resetInFlight();
    for (;;) {
      const ops = await this.outbox.pending(100);
      if (ops.length === 0) return;
      await this.outbox.markInFlight(ops.map((op) => op.seq));
      const response = await this.api.request<{ results: ApiPushResult[] }>('POST', '/sync/push', {
        auth: 'required',
        body: {
          operations: ops.map((op) => ({
            opId: op.opId,
            entityType: op.entityType,
            action: op.action,
            entityId: op.entityId,
            baseVersion: op.baseVersion,
            ...(op.payload ? { payload: op.payload } : {}),
          })),
        },
      });
      const byOpId = new Map(response.results.map((r) => [r.opId, r]));
      for (const op of ops) {
        const result = byOpId.get(op.opId);
        if (result) await this.applyPushResult(op, result, report);
      }
      report.pushed += ops.length;
    }
  }

  private async applyPushResult(
    op: OutboxOp,
    result: ApiPushResult,
    report: SyncReport,
  ): Promise<void> {
    await inTransaction(this.db, async () => {
      await this.outbox.remove(op.seq);
      const canonicalId = result.canonicalId ?? op.entityId;
      const entity = result.entity as { version?: number; deletedAt?: string | null } | null;

      if (result.status === 'APPLIED' || result.status === 'MERGED') {
        if (canonicalId !== op.entityId)
          await this.rekeyLocal(op.entityType, op.entityId, canonicalId);
        if (entity?.version !== undefined && !entity.deletedAt) {
          await this.db.runAsync(
            `UPDATE ${TABLE[op.entityType]} SET version = ? WHERE id = ?`,
            entity.version,
            canonicalId,
          );
        }
        if (entity?.version !== undefined)
          await this.outbox.rebase(op.entityType, canonicalId, entity.version);
        return;
      }

      if (result.status === 'CONFLICT') {
        report.conflicts += 1;
        await this.outbox.dropForEntity(op.entityType, op.entityId);
        if (canonicalId !== op.entityId) await this.deleteLocal(op.entityType, op.entityId);
        if (entity)
          await this.applyServerEntity(op.entityType, entity as Record<string, unknown>, true);
        await this.notice(
          result.reason === 'DELETED_ON_SERVER'
            ? `Se eliminó ${LABEL[op.entityType]} que habías cambiado: ya estaba borrado en otro dispositivo.`
            : `Conflicto en ${LABEL[op.entityType]}: se conservó la versión guardada en el servidor.`,
        );
        return;
      }

      report.rejected += 1;
      await this.outbox.dropForEntity(op.entityType, op.entityId);
      if (op.action === 'UPSERT' && op.baseVersion === null)
        await this.deleteLocal(op.entityType, op.entityId);
      await this.notice(
        `El servidor rechazó un cambio en ${LABEL[op.entityType]} (${result.reason ?? 'motivo desconocido'}).`,
      );
    });
  }

  private async pull(report: SyncReport, loggedIn: boolean): Promise<void> {
    const since = await getMeta(this.db, CURSOR_KEY);
    const changes = await this.api.request<ApiChanges>(
      'GET',
      `/sync/changes${since ? `?since=${encodeURIComponent(since)}` : ''}`,
      { auth: loggedIn ? 'optional' : 'none' },
    );

    let catalogChanged = false;
    await inTransaction(this.db, async () => {
      for (const entry of changes.content) {
        const before = await this.db.getFirstAsync<{ version: number; deleted: number }>(
          'SELECT version, deleted FROM remote_manifest WHERE resource_type = ? AND resource_id = ?',
          entry.resourceType,
          entry.resourceId,
        );
        if (
          !before ||
          before.version !== entry.version ||
          before.deleted !== fromBool(entry.deleted)
        ) {
          report.contentChanges += 1;
          if (CATALOG_TYPES.includes(entry.resourceType)) catalogChanged = true;
        }
        await this.db.runAsync(
          `INSERT INTO remote_manifest (resource_type, resource_id, version, deleted, updated_at)
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(resource_type, resource_id) DO UPDATE SET version = excluded.version,
             deleted = excluded.deleted, updated_at = excluded.updated_at`,
          entry.resourceType,
          entry.resourceId,
          entry.version,
          fromBool(entry.deleted),
          entry.updatedAt,
        );
        if (entry.resourceType === 'RECIPE') {
          // Withdrawn on the server: keep the local copy, just flag it (never delete offline content).
          await this.db.runAsync(
            'UPDATE recipes SET withdrawn = ? WHERE id = ?',
            fromBool(entry.deleted),
            entry.resourceId,
          );
        }
      }
    });

    if (catalogChanged || !since) await this.refreshCatalogLists();
    await replaceSubstitutions(
      this.db,
      await this.api.request<ApiSubstitution[]>('GET', '/substitutions'),
    );
    await setMeta(this.db, 'substitutions_from_server', '1');

    if (changes.user) {
      const user = changes.user;
      await inTransaction(this.db, async () => {
        const apply = async (
          type: EntityType,
          records: Array<Record<string, unknown> & { id: string; version: number }>,
        ) => {
          for (const record of records) {
            if (await this.outbox.hasPending(type, record.id)) continue;
            const local = await this.db.getFirstAsync<{ version: number }>(
              `SELECT version FROM ${TABLE[type]} WHERE id = ?`,
              record.id,
            );
            if (local && local.version >= record.version && !record.deletedAt) continue;
            if (await this.applyServerEntity(type, record, false)) report.userChanges += 1;
          }
        };
        await apply(
          'SHOPPING_LIST',
          user.shoppingLists as unknown as Array<ApiShoppingList & Record<string, unknown>>,
        );
        await apply(
          'SHOPPING_LIST_ITEM',
          user.shoppingListItems as unknown as Array<ApiShoppingListItem & Record<string, unknown>>,
        );
        await apply(
          'FAVORITE',
          user.favorites as unknown as Array<ApiFavorite & Record<string, unknown>>,
        );
        await apply(
          'INVENTORY',
          user.inventory as unknown as Array<ApiInventoryItem & Record<string, unknown>>,
        );
      });
    }
    await setMeta(this.db, CURSOR_KEY, changes.nextSince);
  }

  /**
   * Writes a server record locally (or removes it if it is a tombstone). A different local row with
   * the same natural key is replaced unless it still has pending changes (then the server record
   * waits for the next sync, after the push resolves the duplicate). Returns true if applied.
   */
  private async applyServerEntity(
    type: EntityType,
    record: Record<string, unknown>,
    force: boolean,
  ): Promise<boolean> {
    const id = record.id as string;
    if (record.deletedAt) return (await this.deleteLocal(type, id)) > 0;
    const version = record.version as number;
    switch (type) {
      case 'FAVORITE': {
        if (
          !(await this.clearNaturalKey(
            'favorites',
            'recipe_id = ?',
            [record.recipeId as string],
            id,
            type,
            force,
          ))
        )
          return false;
        await this.db.runAsync(
          `INSERT INTO favorites (id, recipe_id, version, created_at) VALUES (?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET recipe_id = excluded.recipe_id, version = excluded.version`,
          id,
          record.recipeId as string,
          version,
          (record.createdAt as string | undefined) ?? nowIso(),
        );
        return true;
      }
      case 'INVENTORY': {
        if (
          !(await this.clearNaturalKey(
            'inventory',
            'ingredient_id = ?',
            [record.ingredientId as string],
            id,
            type,
            force,
          ))
        )
          return false;
        await this.db.runAsync(
          `INSERT INTO inventory (id, ingredient_id, quantity, unit, expiration_date, version, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET ingredient_id = excluded.ingredient_id, quantity = excluded.quantity,
             unit = excluded.unit, expiration_date = excluded.expiration_date, version = excluded.version,
             updated_at = excluded.updated_at`,
          id,
          record.ingredientId as string,
          (record.quantity as number | null) ?? null,
          (record.unit as Unit | null) ?? null,
          (record.expirationDate as string | null) ?? null,
          version,
          nowIso(),
        );
        return true;
      }
      case 'SHOPPING_LIST': {
        await this.db.runAsync(
          `INSERT INTO shopping_lists (id, name, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET name = excluded.name, version = excluded.version,
             updated_at = excluded.updated_at`,
          id,
          record.name as string,
          version,
          (record.createdAt as string | undefined) ?? nowIso(),
          (record.updatedAt as string | undefined) ?? nowIso(),
        );
        return true;
      }
      case 'SHOPPING_LIST_ITEM': {
        const listId = record.shoppingListId as string;
        if (!(await this.db.getFirstAsync('SELECT 1 FROM shopping_lists WHERE id = ?', listId)))
          return false;
        if (
          !(await this.clearNaturalKey(
            'shopping_list_items',
            'shopping_list_id = ? AND ingredient_id = ?',
            [listId, record.ingredientId as string],
            id,
            type,
            force,
          ))
        ) {
          return false;
        }
        await this.db.runAsync(
          `INSERT INTO shopping_list_items (id, shopping_list_id, ingredient_id, quantity, unit, completed, version)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET quantity = excluded.quantity, unit = excluded.unit,
             completed = excluded.completed, version = excluded.version`,
          id,
          listId,
          record.ingredientId as string,
          (record.quantity as number | null) ?? null,
          (record.unit as Unit | null) ?? null,
          fromBool(Boolean(record.completed)),
          version,
        );
        return true;
      }
    }
  }

  private async clearNaturalKey(
    table: string,
    where: string,
    params: string[],
    keepId: string,
    type: EntityType,
    force: boolean,
  ): Promise<boolean> {
    const others = await this.db.getAllAsync<{ id: string }>(
      `SELECT id FROM ${table} WHERE ${where} AND id <> ?`,
      ...params,
      keepId,
    );
    for (const other of others) {
      if (!force && (await this.outbox.hasPending(type, other.id))) return false;
      await this.outbox.dropForEntity(type, other.id);
      await this.db.runAsync(`DELETE FROM ${table} WHERE id = ?`, other.id);
    }
    return true;
  }

  private async rekeyLocal(type: EntityType, fromId: string, toId: string): Promise<void> {
    const table = TABLE[type];
    const target = await this.db.getFirstAsync(`SELECT 1 FROM ${table} WHERE id = ?`, toId);
    if (target) await this.db.runAsync(`DELETE FROM ${table} WHERE id = ?`, fromId);
    else await this.db.runAsync(`UPDATE ${table} SET id = ? WHERE id = ?`, toId, fromId);
    await this.outbox.rekey(type, fromId, toId);
  }

  private async deleteLocal(type: EntityType, id: string): Promise<number> {
    return (await this.db.runAsync(`DELETE FROM ${TABLE[type]} WHERE id = ?`, id)).changes;
  }

  private async notice(message: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO sync_notices (created_at, message) VALUES (?, ?)',
      nowIso(),
      message,
    );
  }

  /** Refreshes categories, ingredients, glassware, equipment and techniques from the server. */
  private async refreshCatalogLists(): Promise<void> {
    const categories = await this.api.request<ApiCategory[]>('GET', '/categories');
    const ingredients: ApiIngredient[] = [];
    for (let page = 1; ; page += 1) {
      const res = await this.api.request<ApiPage<ApiIngredient>>(
        'GET',
        `/ingredients?page=${page}&pageSize=100`,
      );
      ingredients.push(...res.items);
      if (page * res.pageSize >= res.total) break;
    }
    const glassware = await this.api.request<ApiGlassware[]>('GET', '/glassware');
    const equipment = await this.api.request<ApiEquipment[]>('GET', '/equipment');
    const techniques = await this.api.request<ApiTechnique[]>('GET', '/techniques');
    await inTransaction(this.db, async () => {
      for (const c of categories) await upsertCategory(this.db, c);
      for (const i of ingredients) {
        await upsertIngredient(this.db, { ...i, categoryId: i.category.id });
      }
      for (const g of glassware) await upsertGlassware(this.db, g);
      for (const e of equipment) await upsertEquipment(this.db, e);
      for (const t of techniques) {
        await upsertTechnique(this.db, { ...t, equipmentIds: t.equipment.map((e) => e.id) });
      }
    });
  }

  private async ensureCatalogFor(recipe: ApiRecipeDetail): Promise<void> {
    const missing = async (table: string, ids: string[]) => {
      for (const id of ids) {
        if (!(await this.db.getFirstAsync(`SELECT 1 FROM ${table} WHERE id = ?`, id))) return true;
      }
      return false;
    };
    const needsLists =
      (await missing(
        'ingredients',
        recipe.ingredients.map((i) => i.ingredientId),
      )) ||
      (await missing(
        'categories',
        recipe.categories.map((c) => c.id),
      )) ||
      (recipe.glassware !== null && (await missing('glassware', [recipe.glassware.id]))) ||
      (recipe.technique !== null && (await missing('techniques', [recipe.technique.id])));
    if (needsLists) await this.refreshCatalogLists();
  }
}
