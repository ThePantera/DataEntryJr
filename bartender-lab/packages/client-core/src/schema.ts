import type { Db } from './db';

/**
 * Local schema. Content tables mirror the server (normalized: recipe ingredients live in
 * recipe_ingredients, never as free text). User tables keep `version` = last server version seen
 * (0 = created on this device and not yet synced). Deleted user records are removed locally; the
 * pending DELETE in `outbox` carries the deletion to the server.
 */
const MIGRATIONS: string[] = [
  `
  CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);

  CREATE TABLE categories (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, kind TEXT NOT NULL,
    version INTEGER NOT NULL
  );
  CREATE TABLE ingredients (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, category_id TEXT NOT NULL,
    alcohol_percentage REAL NOT NULL DEFAULT 0, image_url TEXT,
    allergens TEXT NOT NULL DEFAULT '[]', version INTEGER NOT NULL
  );
  CREATE TABLE glassware (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, capacity_ml INTEGER,
    image_url TEXT, version INTEGER NOT NULL
  );
  CREATE TABLE equipment (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, image_url TEXT,
    version INTEGER NOT NULL
  );
  CREATE TABLE techniques (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, duration_seconds INTEGER,
    instructions TEXT NOT NULL, common_mistakes TEXT NOT NULL DEFAULT '[]', version INTEGER NOT NULL
  );
  CREATE TABLE technique_equipment (
    technique_id TEXT NOT NULL REFERENCES techniques(id) ON DELETE CASCADE,
    equipment_id TEXT NOT NULL,
    PRIMARY KEY (technique_id, equipment_id)
  );
  CREATE TABLE recipes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, description TEXT NOT NULL,
    history TEXT, difficulty TEXT NOT NULL, preparation_time_seconds INTEGER,
    servings INTEGER NOT NULL DEFAULT 1, glassware_id TEXT, technique_id TEXT, ice_type TEXT,
    garnish TEXT, alcohol_percentage_estimated REAL, instructions TEXT, image_url TEXT,
    source TEXT, origin TEXT NOT NULL, version INTEGER NOT NULL,
    bundled INTEGER NOT NULL DEFAULT 0,   -- 1 = came with the app
    withdrawn INTEGER NOT NULL DEFAULT 0, -- 1 = no longer published on the server (copy kept)
    downloaded_at TEXT
  );
  CREATE TABLE recipe_ingredients (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL, quantity REAL, unit TEXT NOT NULL,
    optional INTEGER NOT NULL DEFAULT 0, position INTEGER NOT NULL
  );
  CREATE INDEX recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
  CREATE INDEX recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
  CREATE TABLE recipe_steps (
    id TEXT PRIMARY KEY,
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL, instruction TEXT NOT NULL, duration_seconds INTEGER, image_url TEXT
  );
  CREATE TABLE recipe_categories (
    recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    PRIMARY KEY (recipe_id, category_id)
  );
  CREATE TABLE substitutions (
    id TEXT PRIMARY KEY, ingredient_id TEXT NOT NULL, substitute_id TEXT NOT NULL,
    recipe_id TEXT, ratio REAL NOT NULL, notes TEXT
  );

  CREATE TABLE inventory (
    id TEXT PRIMARY KEY, ingredient_id TEXT NOT NULL UNIQUE, quantity REAL, unit TEXT,
    expiration_date TEXT, version INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL
  );
  CREATE TABLE favorites (
    id TEXT PRIMARY KEY, recipe_id TEXT NOT NULL UNIQUE, version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE shopping_lists (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE shopping_list_items (
    id TEXT PRIMARY KEY,
    shopping_list_id TEXT NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
    ingredient_id TEXT NOT NULL, quantity REAL, unit TEXT, completed INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 0,
    UNIQUE (shopping_list_id, ingredient_id)
  );

  -- Pending operations for POST /sync/push, in order. in_flight = sent, awaiting the result.
  CREATE TABLE outbox (
    seq INTEGER PRIMARY KEY AUTOINCREMENT, op_id TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL, action TEXT NOT NULL, entity_id TEXT NOT NULL,
    base_version INTEGER, payload TEXT, in_flight INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE INDEX outbox_entity ON outbox(entity_type, entity_id);

  -- Server manifest as last seen: detects outdated and withdrawn local copies.
  CREATE TABLE remote_manifest (
    resource_type TEXT NOT NULL, resource_id TEXT NOT NULL, version INTEGER NOT NULL,
    deleted INTEGER NOT NULL, updated_at TEXT NOT NULL,
    PRIMARY KEY (resource_type, resource_id)
  );

  -- Messages for the user about sync results (conflicts, rejected changes).
  CREATE TABLE sync_notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT, created_at TEXT NOT NULL, message TEXT NOT NULL
  );
  `,
];

export async function migrate(db: Db): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON');
  await db.execAsync('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = await db.getFirstAsync<{ version: number }>('SELECT version FROM schema_version');
  let version = row?.version ?? 0;
  if (!row) await db.runAsync('INSERT INTO schema_version (version) VALUES (0)');
  while (version < MIGRATIONS.length) {
    await db.execAsync(MIGRATIONS[version]);
    version += 1;
    await db.runAsync('UPDATE schema_version SET version = ?', version);
  }
}

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    key,
  );
  return row?.value ?? null;
}

export async function setMeta(db: Db, key: string, value: string | null): Promise<void> {
  if (value === null) await db.runAsync('DELETE FROM meta WHERE key = ?', key);
  else {
    await db.runAsync(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      key,
      value,
    );
  }
}
