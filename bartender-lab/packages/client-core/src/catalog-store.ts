import type {
  CatalogBundle,
  CatalogCategory,
  CatalogEquipment,
  CatalogGlassware,
  CatalogIngredient,
  CatalogRecipe,
  CatalogSubstitution,
  CatalogTechnique,
} from '@bartender-lab/shared';
import { fromBool, inTransaction, nowIso, type Db } from './db';
import { getMeta, setMeta } from './schema';

/**
 * Writes catalog content into the local database. Every upsert is version-aware: a row is only
 * replaced by a strictly newer version, so an old bundle never overwrites a newer download.
 * Content is never deleted here: withdrawn recipes stay available offline (spec: a connection
 * failure must never remove downloaded content).
 */
export async function upsertCategory(db: Db, c: CatalogCategory): Promise<void> {
  await db.runAsync(
    `INSERT INTO categories (id, name, description, kind, version) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
       kind = excluded.kind, version = excluded.version
     WHERE excluded.version > categories.version`,
    c.id,
    c.name,
    c.description,
    c.kind,
    c.version,
  );
}

export async function upsertIngredient(db: Db, i: CatalogIngredient): Promise<void> {
  await db.runAsync(
    `INSERT INTO ingredients (id, name, description, category_id, alcohol_percentage, image_url, allergens, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
       category_id = excluded.category_id, alcohol_percentage = excluded.alcohol_percentage,
       image_url = excluded.image_url, allergens = excluded.allergens, version = excluded.version
     WHERE excluded.version > ingredients.version`,
    i.id,
    i.name,
    i.description,
    i.categoryId,
    i.alcoholPercentage,
    i.imageUrl,
    JSON.stringify(i.allergens),
    i.version,
  );
}

export async function upsertGlassware(db: Db, g: CatalogGlassware): Promise<void> {
  await db.runAsync(
    `INSERT INTO glassware (id, name, description, capacity_ml, image_url, version) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
       capacity_ml = excluded.capacity_ml, image_url = excluded.image_url, version = excluded.version
     WHERE excluded.version > glassware.version`,
    g.id,
    g.name,
    g.description,
    g.capacityMl,
    g.imageUrl,
    g.version,
  );
}

export async function upsertEquipment(db: Db, e: CatalogEquipment): Promise<void> {
  await db.runAsync(
    `INSERT INTO equipment (id, name, description, image_url, version) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
       image_url = excluded.image_url, version = excluded.version
     WHERE excluded.version > equipment.version`,
    e.id,
    e.name,
    e.description,
    e.imageUrl,
    e.version,
  );
}

export async function upsertTechnique(db: Db, t: CatalogTechnique): Promise<void> {
  const current = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM techniques WHERE id = ?',
    t.id,
  );
  if (current && current.version >= t.version) return;
  await db.runAsync(
    `INSERT INTO techniques (id, name, description, duration_seconds, instructions, common_mistakes, version)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, description = excluded.description,
       duration_seconds = excluded.duration_seconds, instructions = excluded.instructions,
       common_mistakes = excluded.common_mistakes, version = excluded.version`,
    t.id,
    t.name,
    t.description,
    t.durationSeconds,
    t.instructions,
    JSON.stringify(t.commonMistakes),
    t.version,
  );
  await db.runAsync('DELETE FROM technique_equipment WHERE technique_id = ?', t.id);
  for (const equipmentId of t.equipmentIds) {
    await db.runAsync(
      'INSERT INTO technique_equipment (technique_id, equipment_id) VALUES (?, ?)',
      t.id,
      equipmentId,
    );
  }
}

/** Returns true when the recipe was inserted or replaced by a newer version. */
export async function upsertRecipe(
  db: Db,
  r: CatalogRecipe,
  origin: 'bundle' | 'download',
): Promise<boolean> {
  const current = await db.getFirstAsync<{ version: number }>(
    'SELECT version FROM recipes WHERE id = ?',
    r.id,
  );
  if (current && current.version >= r.version) {
    // Same content: the server publishing it again still clears a previous withdrawal.
    if (origin === 'download')
      await db.runAsync('UPDATE recipes SET withdrawn = 0 WHERE id = ?', r.id);
    return false;
  }
  await db.runAsync(
    `INSERT INTO recipes (id, name, slug, description, history, difficulty, preparation_time_seconds,
       servings, glassware_id, technique_id, ice_type, garnish, alcohol_percentage_estimated,
       instructions, image_url, source, origin, version, bundled, withdrawn, downloaded_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
     ON CONFLICT(id) DO UPDATE SET name = excluded.name, slug = excluded.slug,
       description = excluded.description, history = excluded.history,
       difficulty = excluded.difficulty, preparation_time_seconds = excluded.preparation_time_seconds,
       servings = excluded.servings, glassware_id = excluded.glassware_id,
       technique_id = excluded.technique_id, ice_type = excluded.ice_type, garnish = excluded.garnish,
       alcohol_percentage_estimated = excluded.alcohol_percentage_estimated,
       instructions = excluded.instructions, image_url = excluded.image_url, source = excluded.source,
       origin = excluded.origin, version = excluded.version, withdrawn = 0,
       downloaded_at = COALESCE(excluded.downloaded_at, recipes.downloaded_at)`,
    r.id,
    r.name,
    r.slug,
    r.description,
    r.history,
    r.difficulty,
    r.preparationTimeSeconds,
    r.servings,
    r.glasswareId,
    r.techniqueId,
    r.iceType,
    r.garnish,
    r.alcoholPercentageEstimated,
    r.instructions,
    r.imageUrl,
    r.source,
    r.origin,
    r.version,
    fromBool(origin === 'bundle'),
    origin === 'download' ? nowIso() : null,
  );
  for (const table of ['recipe_ingredients', 'recipe_steps', 'recipe_categories']) {
    await db.runAsync(`DELETE FROM ${table} WHERE recipe_id = ?`, r.id);
  }
  for (const line of r.ingredients) {
    await db.runAsync(
      `INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, quantity, unit, optional, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      line.id,
      r.id,
      line.ingredientId,
      line.quantity,
      line.unit,
      fromBool(line.optional),
      line.position,
    );
  }
  for (const step of r.steps) {
    await db.runAsync(
      `INSERT INTO recipe_steps (id, recipe_id, step_number, instruction, duration_seconds, image_url)
       VALUES (?, ?, ?, ?, ?, ?)`,
      step.id,
      r.id,
      step.stepNumber,
      step.instruction,
      step.durationSeconds,
      step.imageUrl,
    );
  }
  for (const categoryId of r.categoryIds) {
    await db.runAsync(
      'INSERT INTO recipe_categories (recipe_id, category_id) VALUES (?, ?)',
      r.id,
      categoryId,
    );
  }
  return true;
}

/** Substitutions come as a complete list (they are few), so they are replaced wholesale. */
export async function replaceSubstitutions(
  db: Db,
  substitutions: CatalogSubstitution[],
): Promise<void> {
  await inTransaction(db, async () => {
    await db.runAsync('DELETE FROM substitutions');
    for (const s of substitutions) {
      await db.runAsync(
        'INSERT INTO substitutions (id, ingredient_id, substitute_id, recipe_id, ratio, notes) VALUES (?, ?, ?, ?, ?, ?)',
        s.id,
        s.ingredientId,
        s.substituteId,
        s.recipeId,
        s.ratio,
        s.notes,
      );
    }
  });
}

function bundleSignature(bundle: CatalogBundle): string {
  const versions = (rows: Array<{ id: string; version?: number }>) =>
    rows.map((r) => `${r.id}:${r.version ?? 0}`).join(',');
  return [
    bundle.formatVersion,
    versions(bundle.categories),
    versions(bundle.ingredients),
    versions(bundle.techniques),
    versions(bundle.recipes),
    bundle.substitutions.map((s) => s.id).join(','),
  ].join('|');
}

/**
 * Loads the catalog bundled with the app. Cheap to call on every start: it only writes when the
 * bundle changed (a new app version). Returns true when something was imported.
 */
export async function importBundledCatalog(db: Db, bundle: CatalogBundle): Promise<boolean> {
  const signature = bundleSignature(bundle);
  if ((await getMeta(db, 'bundle_signature')) === signature) return false;
  await inTransaction(db, async () => {
    for (const c of bundle.categories) await upsertCategory(db, c);
    for (const i of bundle.ingredients) await upsertIngredient(db, i);
    for (const g of bundle.glassware) await upsertGlassware(db, g);
    for (const e of bundle.equipment) await upsertEquipment(db, e);
    for (const t of bundle.techniques) await upsertTechnique(db, t);
    for (const r of bundle.recipes) await upsertRecipe(db, r, 'bundle');
    if ((await getMeta(db, 'substitutions_from_server')) !== '1') {
      await replaceSubstitutions(db, bundle.substitutions);
    }
    await setMeta(db, 'bundle_signature', signature);
  });
  return true;
}
