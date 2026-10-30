import { scaleQuantity, type Unit } from '@bartender-lab/shared';
import { fromBool, inTransaction, nowIso, toBool, type Db } from './db';
import type { Outbox } from './outbox';

export interface InventoryItemView {
  id: string;
  ingredientId: string;
  ingredientName: string;
  categoryName: string | null;
  quantity: number | null;
  unit: Unit | null;
  expirationDate: string | null;
  /** quantity === 0: kept in the bar but not available for recipes. */
  depleted: boolean;
}

export interface InventoryInput {
  ingredientId: string;
  quantity?: number | null;
  unit?: Unit | null;
  expirationDate?: string | null;
}

export interface FavoriteView {
  id: string;
  recipeId: string;
  createdAt: string;
}

export interface ShoppingListView {
  id: string;
  name: string;
  itemCount: number;
  completedCount: number;
  updatedAt: string;
}

export interface ShoppingItemView {
  id: string;
  shoppingListId: string;
  ingredientId: string;
  ingredientName: string;
  quantity: number | null;
  unit: Unit | null;
  completed: boolean;
}

/** Every change is written locally and queued for the server in the same transaction. */
export class InventoryRepository {
  constructor(
    private readonly db: Db,
    private readonly outbox: Outbox,
    private readonly newId: () => string,
  ) {}

  async list(): Promise<InventoryItemView[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      ingredient_id: string;
      name: string;
      category_name: string | null;
      quantity: number | null;
      unit: Unit | null;
      expiration_date: string | null;
    }>(
      `SELECT inv.id, inv.ingredient_id, i.name, c.name AS category_name, inv.quantity, inv.unit,
              inv.expiration_date
       FROM inventory inv JOIN ingredients i ON i.id = inv.ingredient_id
       LEFT JOIN categories c ON c.id = i.category_id
       ORDER BY i.name`,
    );
    return rows.map((r) => ({
      id: r.id,
      ingredientId: r.ingredient_id,
      ingredientName: r.name,
      categoryName: r.category_name,
      quantity: r.quantity,
      unit: r.unit,
      expirationDate: r.expiration_date,
      depleted: r.quantity === 0,
    }));
  }

  /** Adds an ingredient to the bar, or updates it if it is already there. */
  async save(input: InventoryInput): Promise<string> {
    return inTransaction(this.db, async () => {
      const existing = await this.db.getFirstAsync<{ id: string; version: number }>(
        'SELECT id, version FROM inventory WHERE ingredient_id = ?',
        input.ingredientId,
      );
      const id = existing?.id ?? this.newId();
      const state = {
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        expirationDate: input.expirationDate ?? null,
      };
      if (existing) {
        await this.db.runAsync(
          'UPDATE inventory SET quantity = ?, unit = ?, expiration_date = ?, updated_at = ? WHERE id = ?',
          state.quantity,
          state.unit,
          state.expirationDate,
          nowIso(),
          id,
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO inventory (id, ingredient_id, quantity, unit, expiration_date, version, updated_at)
           VALUES (?, ?, ?, ?, ?, 0, ?)`,
          id,
          input.ingredientId,
          state.quantity,
          state.unit,
          state.expirationDate,
          nowIso(),
        );
      }
      await this.outbox.enqueue('INVENTORY', 'UPSERT', id, existing?.version ?? 0, {
        ingredientId: input.ingredientId,
        ...state,
      });
      return id;
    });
  }

  async remove(id: string): Promise<void> {
    await inTransaction(this.db, async () => {
      const row = await this.db.getFirstAsync<{ version: number }>(
        'SELECT version FROM inventory WHERE id = ?',
        id,
      );
      if (!row) return;
      await this.db.runAsync('DELETE FROM inventory WHERE id = ?', id);
      await this.outbox.enqueue('INVENTORY', 'DELETE', id, row.version, null);
    });
  }
}

export class FavoritesRepository {
  constructor(
    private readonly db: Db,
    private readonly outbox: Outbox,
    private readonly newId: () => string,
  ) {}

  async list(): Promise<FavoriteView[]> {
    const rows = await this.db.getAllAsync<{ id: string; recipe_id: string; created_at: string }>(
      'SELECT id, recipe_id, created_at FROM favorites ORDER BY created_at DESC',
    );
    return rows.map((r) => ({ id: r.id, recipeId: r.recipe_id, createdAt: r.created_at }));
  }

  async isFavorite(recipeId: string): Promise<boolean> {
    return (
      (await this.db.getFirstAsync('SELECT 1 FROM favorites WHERE recipe_id = ?', recipeId)) !==
      null
    );
  }

  async add(recipeId: string): Promise<void> {
    await inTransaction(this.db, async () => {
      if (await this.isFavorite(recipeId)) return;
      const id = this.newId();
      await this.db.runAsync(
        'INSERT INTO favorites (id, recipe_id, version, created_at) VALUES (?, ?, 0, ?)',
        id,
        recipeId,
        nowIso(),
      );
      await this.outbox.enqueue('FAVORITE', 'UPSERT', id, 0, { recipeId });
    });
  }

  async remove(recipeId: string): Promise<void> {
    await inTransaction(this.db, async () => {
      const row = await this.db.getFirstAsync<{ id: string; version: number }>(
        'SELECT id, version FROM favorites WHERE recipe_id = ?',
        recipeId,
      );
      if (!row) return;
      await this.db.runAsync('DELETE FROM favorites WHERE id = ?', row.id);
      await this.outbox.enqueue('FAVORITE', 'DELETE', row.id, row.version, null);
    });
  }

  /** Returns the new state: true = now a favorite. */
  async toggle(recipeId: string): Promise<boolean> {
    if (await this.isFavorite(recipeId)) {
      await this.remove(recipeId);
      return false;
    }
    await this.add(recipeId);
    return true;
  }
}

export class ShoppingListsRepository {
  constructor(
    private readonly db: Db,
    private readonly outbox: Outbox,
    private readonly newId: () => string,
  ) {}

  async lists(): Promise<ShoppingListView[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      name: string;
      updated_at: string;
      item_count: number;
      completed_count: number;
    }>(
      `SELECT l.id, l.name, l.updated_at,
              (SELECT COUNT(*) FROM shopping_list_items i WHERE i.shopping_list_id = l.id) AS item_count,
              (SELECT COUNT(*) FROM shopping_list_items i WHERE i.shopping_list_id = l.id AND i.completed = 1)
                AS completed_count
       FROM shopping_lists l ORDER BY l.updated_at DESC`,
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      itemCount: r.item_count,
      completedCount: r.completed_count,
      updatedAt: r.updated_at,
    }));
  }

  async getList(
    id: string,
  ): Promise<{ id: string; name: string; items: ShoppingItemView[] } | null> {
    const list = await this.db.getFirstAsync<{ id: string; name: string }>(
      'SELECT id, name FROM shopping_lists WHERE id = ?',
      id,
    );
    if (!list) return null;
    const items = await this.db.getAllAsync<{
      id: string;
      shopping_list_id: string;
      ingredient_id: string;
      name: string;
      quantity: number | null;
      unit: Unit | null;
      completed: number;
    }>(
      `SELECT s.id, s.shopping_list_id, s.ingredient_id, i.name, s.quantity, s.unit, s.completed
       FROM shopping_list_items s JOIN ingredients i ON i.id = s.ingredient_id
       WHERE s.shopping_list_id = ? ORDER BY s.completed, i.name`,
      id,
    );
    return {
      ...list,
      items: items.map((i) => ({
        id: i.id,
        shoppingListId: i.shopping_list_id,
        ingredientId: i.ingredient_id,
        ingredientName: i.name,
        quantity: i.quantity,
        unit: i.unit,
        completed: toBool(i.completed),
      })),
    };
  }

  async create(name: string): Promise<string> {
    return inTransaction(this.db, async () => {
      const id = this.newId();
      const now = nowIso();
      await this.db.runAsync(
        'INSERT INTO shopping_lists (id, name, version, created_at, updated_at) VALUES (?, ?, 0, ?, ?)',
        id,
        name.trim(),
        now,
        now,
      );
      await this.outbox.enqueue('SHOPPING_LIST', 'UPSERT', id, 0, { name: name.trim() });
      return id;
    });
  }

  async rename(id: string, name: string): Promise<void> {
    await inTransaction(this.db, async () => {
      const row = await this.db.getFirstAsync<{ version: number }>(
        'SELECT version FROM shopping_lists WHERE id = ?',
        id,
      );
      if (!row) return;
      await this.db.runAsync(
        'UPDATE shopping_lists SET name = ?, updated_at = ? WHERE id = ?',
        name.trim(),
        nowIso(),
        id,
      );
      await this.outbox.enqueue('SHOPPING_LIST', 'UPSERT', id, row.version, { name: name.trim() });
    });
  }

  async remove(id: string): Promise<void> {
    await inTransaction(this.db, async () => {
      const row = await this.db.getFirstAsync<{ version: number }>(
        'SELECT version FROM shopping_lists WHERE id = ?',
        id,
      );
      if (!row) return;
      await this.db.runAsync('DELETE FROM shopping_lists WHERE id = ?', id);
      await this.outbox.dropItemsOfList(id);
      await this.outbox.enqueue('SHOPPING_LIST', 'DELETE', id, row.version, null);
    });
  }

  /** Adds an ingredient, or replaces its quantity if it is already on the list. */
  async addItem(
    listId: string,
    ingredientId: string,
    quantity: number | null = null,
    unit: Unit | null = null,
  ) {
    await inTransaction(this.db, async () => {
      const existing = await this.db.getFirstAsync<{
        id: string;
        version: number;
        completed: number;
      }>(
        'SELECT id, version, completed FROM shopping_list_items WHERE shopping_list_id = ? AND ingredient_id = ?',
        listId,
        ingredientId,
      );
      const id = existing?.id ?? this.newId();
      if (existing) {
        await this.db.runAsync(
          'UPDATE shopping_list_items SET quantity = ?, unit = ?, completed = 0 WHERE id = ?',
          quantity,
          unit,
          id,
        );
      } else {
        await this.db.runAsync(
          `INSERT INTO shopping_list_items (id, shopping_list_id, ingredient_id, quantity, unit, completed, version)
           VALUES (?, ?, ?, ?, ?, 0, 0)`,
          id,
          listId,
          ingredientId,
          quantity,
          unit,
        );
      }
      await this.touch(listId);
      await this.outbox.enqueue('SHOPPING_LIST_ITEM', 'UPSERT', id, existing?.version ?? 0, {
        shoppingListId: listId,
        ingredientId,
        quantity,
        unit,
        completed: false,
      });
    });
  }

  async setCompleted(itemId: string, completed: boolean): Promise<void> {
    await inTransaction(this.db, async () => {
      const item = await this.db.getFirstAsync<{
        shopping_list_id: string;
        ingredient_id: string;
        quantity: number | null;
        unit: Unit | null;
        version: number;
      }>('SELECT * FROM shopping_list_items WHERE id = ?', itemId);
      if (!item) return;
      await this.db.runAsync(
        'UPDATE shopping_list_items SET completed = ? WHERE id = ?',
        fromBool(completed),
        itemId,
      );
      await this.touch(item.shopping_list_id);
      await this.outbox.enqueue('SHOPPING_LIST_ITEM', 'UPSERT', itemId, item.version, {
        shoppingListId: item.shopping_list_id,
        ingredientId: item.ingredient_id,
        quantity: item.quantity,
        unit: item.unit,
        completed,
      });
    });
  }

  async removeItem(itemId: string): Promise<void> {
    await inTransaction(this.db, async () => {
      const item = await this.db.getFirstAsync<{ shopping_list_id: string; version: number }>(
        'SELECT shopping_list_id, version FROM shopping_list_items WHERE id = ?',
        itemId,
      );
      if (!item) return;
      await this.db.runAsync('DELETE FROM shopping_list_items WHERE id = ?', itemId);
      await this.touch(item.shopping_list_id);
      await this.outbox.enqueue('SHOPPING_LIST_ITEM', 'DELETE', itemId, item.version, null);
    });
  }

  /**
   * Adds the recipe's required ingredients that are not available in the bar, with quantities
   * scaled to `servings`. Returns how many were added.
   */
  async addMissingFromRecipe(listId: string, recipeId: string, servings?: number): Promise<number> {
    const recipe = await this.db.getFirstAsync<{ servings: number }>(
      'SELECT servings FROM recipes WHERE id = ?',
      recipeId,
    );
    if (!recipe) return 0;
    const lines = await this.db.getAllAsync<{
      ingredient_id: string;
      quantity: number | null;
      unit: Unit;
    }>(
      `SELECT ri.ingredient_id, ri.quantity, ri.unit FROM recipe_ingredients ri
       WHERE ri.recipe_id = ? AND ri.optional = 0
         AND ri.ingredient_id NOT IN (
           SELECT ingredient_id FROM inventory WHERE quantity IS NULL OR quantity > 0)
       ORDER BY ri.position`,
      recipeId,
    );
    const factor = (servings ?? recipe.servings) / recipe.servings;
    for (const line of lines) {
      const quantity =
        line.unit === 'TOP_UP' ? null : scaleQuantity(line.quantity, line.unit, factor);
      await this.addItem(
        listId,
        line.ingredient_id,
        quantity,
        line.unit === 'TOP_UP' ? null : line.unit,
      );
    }
    return lines.length;
  }

  private async touch(listId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE shopping_lists SET updated_at = ? WHERE id = ?',
      nowIso(),
      listId,
    );
  }
}
