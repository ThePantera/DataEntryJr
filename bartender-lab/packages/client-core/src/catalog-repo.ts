import {
  matchRecipes,
  scaleIngredients,
  type Allergen,
  type CategoryKind,
  type Difficulty,
  type IceType,
  type MatchClassification,
  type RecipeOrigin,
  type Unit,
} from '@bartender-lab/shared';
import { toBool, type Db } from './db';
import { normalizeText } from './text';

export interface RecipeSummary {
  id: string;
  name: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  origin: RecipeOrigin;
  isOfficialClassic: boolean;
  iceType: IceType | null;
  glasswareName: string | null;
  techniqueName: string | null;
  imageUrl: string | null;
  version: number;
  /** A newer version exists on the server (known after a sync). */
  outdated: boolean;
  /** The server no longer publishes it; the local copy is kept. */
  withdrawn: boolean;
  isFavorite: boolean;
}

export interface RecipeIngredientLine {
  id: string;
  ingredientId: string;
  name: string;
  quantity: number | null;
  unit: Unit;
  optional: boolean;
  position: number;
  inInventory: boolean;
}

export interface RecipeStepView {
  id: string;
  stepNumber: number;
  instruction: string;
  durationSeconds: number | null;
}

export interface RecipeDetail extends RecipeSummary {
  history: string | null;
  servings: number;
  baseServings: number;
  garnish: string | null;
  instructions: string | null;
  source: string | null;
  glassware: { id: string; name: string; capacityMl: number | null } | null;
  technique: { id: string; name: string } | null;
  categories: Array<{ id: string; name: string }>;
  allergens: Allergen[];
  ingredients: RecipeIngredientLine[];
  steps: RecipeStepView[];
}

export interface RecipeFilters {
  search?: string;
  categoryId?: string;
  ingredientId?: string;
  difficulty?: Difficulty;
  origin?: RecipeOrigin;
  favoritesOnly?: boolean;
}

export interface CategoryView {
  id: string;
  name: string;
  description: string | null;
  kind: CategoryKind;
  recipeCount: number;
}

export interface IngredientView {
  id: string;
  name: string;
  description: string | null;
  categoryId: string;
  categoryName: string | null;
  alcoholPercentage: number;
  allergens: Allergen[];
}

export interface TechniqueView {
  id: string;
  name: string;
  description: string;
  durationSeconds: number | null;
  instructions: string;
  commonMistakes: string[];
  equipment: string[];
}

export interface MatchView {
  recipe: RecipeSummary;
  classification: MatchClassification;
  missingRequired: Array<{ id: string; name: string }>;
  missingOptional: Array<{ id: string; name: string }>;
  substitutions: Array<{
    ingredientId: string;
    ingredientName: string;
    substituteId: string;
    substituteName: string;
    ratio: number;
    notes: string | null;
  }>;
}

interface SummaryRow {
  id: string;
  name: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  origin: RecipeOrigin;
  ice_type: IceType | null;
  image_url: string | null;
  version: number;
  withdrawn: number;
  glassware_name: string | null;
  technique_name: string | null;
  server_version: number | null;
  is_favorite: number;
}

const SUMMARY_SQL = `
  SELECT r.id, r.name, r.slug, r.description, r.difficulty, r.origin, r.ice_type, r.image_url,
         r.version, r.withdrawn, g.name AS glassware_name, t.name AS technique_name,
         (SELECT m.version FROM remote_manifest m
            WHERE m.resource_type = 'RECIPE' AND m.resource_id = r.id AND m.deleted = 0) AS server_version,
         EXISTS (SELECT 1 FROM favorites f WHERE f.recipe_id = r.id) AS is_favorite
  FROM recipes r
  LEFT JOIN glassware g ON g.id = r.glassware_id
  LEFT JOIN techniques t ON t.id = r.technique_id`;

function toSummary(row: SummaryRow): RecipeSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    difficulty: row.difficulty,
    origin: row.origin,
    isOfficialClassic: row.origin === 'CLASSIC' && !toBool(row.withdrawn),
    iceType: row.ice_type,
    glasswareName: row.glassware_name,
    techniqueName: row.technique_name,
    imageUrl: row.image_url,
    version: row.version,
    outdated: row.server_version !== null && row.server_version > row.version,
    withdrawn: toBool(row.withdrawn),
    isFavorite: toBool(row.is_favorite),
  };
}

const byName = (a: { name: string }, b: { name: string }) =>
  normalizeText(a.name) < normalizeText(b.name)
    ? -1
    : normalizeText(a.name) > normalizeText(b.name)
      ? 1
      : 0;

export class CatalogRepository {
  constructor(private readonly db: Db) {}

  async listRecipes(filters: RecipeFilters = {}): Promise<RecipeSummary[]> {
    let rows = (await this.db.getAllAsync<SummaryRow>(SUMMARY_SQL)).map(toSummary);
    if (filters.difficulty) rows = rows.filter((r) => r.difficulty === filters.difficulty);
    if (filters.origin) rows = rows.filter((r) => r.origin === filters.origin);
    if (filters.favoritesOnly) rows = rows.filter((r) => r.isFavorite);
    if (filters.categoryId) {
      const ids = await this.idSet(
        'SELECT recipe_id AS id FROM recipe_categories WHERE category_id = ?',
        filters.categoryId,
      );
      rows = rows.filter((r) => ids.has(r.id));
    }
    if (filters.ingredientId) {
      const ids = await this.idSet(
        'SELECT recipe_id AS id FROM recipe_ingredients WHERE ingredient_id = ?',
        filters.ingredientId,
      );
      rows = rows.filter((r) => ids.has(r.id));
    }
    const search = filters.search ? normalizeText(filters.search) : '';
    if (search) {
      const lines = await this.db.getAllAsync<{ recipe_id: string; name: string }>(
        `SELECT ri.recipe_id, i.name FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id`,
      );
      const ingredientText = new Map<string, string>();
      for (const line of lines) {
        ingredientText.set(
          line.recipe_id,
          `${ingredientText.get(line.recipe_id) ?? ''} ${normalizeText(line.name)}`,
        );
      }
      rows = rows.filter(
        (r) =>
          normalizeText(r.name).includes(search) ||
          (ingredientText.get(r.id) ?? '').includes(search),
      );
    }
    return rows.sort(byName);
  }

  async getRecipe(id: string, servings?: number): Promise<RecipeDetail | null> {
    const summary = await this.db.getFirstAsync<SummaryRow>(
      `SELECT * FROM (${SUMMARY_SQL}) WHERE id = ?`,
      id,
    );
    const row = await this.db.getFirstAsync<{
      history: string | null;
      servings: number;
      garnish: string | null;
      instructions: string | null;
      source: string | null;
      glassware_id: string | null;
      technique_id: string | null;
      capacity_ml: number | null;
    }>(
      `SELECT r.history, r.servings, r.garnish, r.instructions, r.source, r.glassware_id,
              r.technique_id, g.capacity_ml
       FROM recipes r LEFT JOIN glassware g ON g.id = r.glassware_id WHERE r.id = ?`,
      id,
    );
    if (!summary || !row) return null;

    const available = new Set(await this.availableIngredientIds());
    const lines = await this.db.getAllAsync<{
      id: string;
      ingredient_id: string;
      name: string;
      quantity: number | null;
      unit: Unit;
      optional: number;
      position: number;
      allergens: string;
    }>(
      `SELECT ri.id, ri.ingredient_id, i.name, ri.quantity, ri.unit, ri.optional, ri.position, i.allergens
       FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
       WHERE ri.recipe_id = ? ORDER BY ri.position`,
      id,
    );
    const baseLines = lines.map((l) => ({
      id: l.id,
      ingredientId: l.ingredient_id,
      name: l.name,
      quantity: l.quantity,
      unit: l.unit,
      optional: toBool(l.optional),
      position: l.position,
      inInventory: available.has(l.ingredient_id),
    }));
    const ingredients =
      servings === undefined ? baseLines : scaleIngredients(baseLines, row.servings, servings);
    const allergens = new Set<Allergen>(
      lines.flatMap((l) => JSON.parse(l.allergens) as Allergen[]),
    );

    const steps = await this.db.getAllAsync<{
      id: string;
      step_number: number;
      instruction: string;
      duration_seconds: number | null;
    }>(
      'SELECT id, step_number, instruction, duration_seconds FROM recipe_steps WHERE recipe_id = ? ORDER BY step_number',
      id,
    );
    const categories = await this.db.getAllAsync<{ id: string; name: string }>(
      `SELECT c.id, c.name FROM recipe_categories rc JOIN categories c ON c.id = rc.category_id
       WHERE rc.recipe_id = ? ORDER BY c.name`,
      id,
    );

    return {
      ...toSummary(summary),
      history: row.history,
      servings: servings ?? row.servings,
      baseServings: row.servings,
      garnish: row.garnish,
      instructions: row.instructions,
      source: row.source,
      glassware: row.glassware_id
        ? { id: row.glassware_id, name: summary.glassware_name ?? '', capacityMl: row.capacity_ml }
        : null,
      technique: row.technique_id
        ? { id: row.technique_id, name: summary.technique_name ?? '' }
        : null,
      categories,
      allergens: [...allergens].sort(),
      ingredients,
      steps: steps.map((s) => ({
        id: s.id,
        stepNumber: s.step_number,
        instruction: s.instruction,
        durationSeconds: s.duration_seconds,
      })),
    };
  }

  async listCategories(kind: CategoryKind): Promise<CategoryView[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      name: string;
      description: string | null;
      kind: CategoryKind;
      recipe_count: number;
    }>(
      `SELECT c.id, c.name, c.description, c.kind,
              (SELECT COUNT(*) FROM recipe_categories rc WHERE rc.category_id = c.id) AS recipe_count
       FROM categories c WHERE c.kind = ?`,
      kind,
    );
    return rows
      .map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        kind: c.kind,
        recipeCount: c.recipe_count,
      }))
      .sort(byName);
  }

  async listIngredients(search?: string): Promise<IngredientView[]> {
    const rows = await this.db.getAllAsync<{
      id: string;
      name: string;
      description: string | null;
      category_id: string;
      category_name: string | null;
      alcohol_percentage: number;
      allergens: string;
    }>(
      `SELECT i.id, i.name, i.description, i.category_id, c.name AS category_name,
              i.alcohol_percentage, i.allergens
       FROM ingredients i LEFT JOIN categories c ON c.id = i.category_id`,
    );
    const term = search ? normalizeText(search) : '';
    return rows
      .filter((i) => !term || normalizeText(i.name).includes(term))
      .map((i) => ({
        id: i.id,
        name: i.name,
        description: i.description,
        categoryId: i.category_id,
        categoryName: i.category_name,
        alcoholPercentage: i.alcohol_percentage,
        allergens: JSON.parse(i.allergens) as Allergen[],
      }))
      .sort(byName);
  }

  async listTechniques(): Promise<TechniqueView[]> {
    const rows = await this.db.getAllAsync<{ id: string }>('SELECT id FROM techniques');
    const techniques = await Promise.all(rows.map((r) => this.getTechnique(r.id)));
    return techniques.filter((t): t is TechniqueView => t !== null).sort(byName);
  }

  async getTechnique(id: string): Promise<TechniqueView | null> {
    const row = await this.db.getFirstAsync<{
      id: string;
      name: string;
      description: string;
      duration_seconds: number | null;
      instructions: string;
      common_mistakes: string;
    }>('SELECT * FROM techniques WHERE id = ?', id);
    if (!row) return null;
    const equipment = await this.db.getAllAsync<{ name: string }>(
      `SELECT e.name FROM technique_equipment te JOIN equipment e ON e.id = te.equipment_id
       WHERE te.technique_id = ?`,
      id,
    );
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      durationSeconds: row.duration_seconds,
      instructions: row.instructions,
      commonMistakes: JSON.parse(row.common_mistakes) as string[],
      equipment: equipment.map((e) => e.name).sort((a, b) => a.localeCompare(b, 'es')),
    };
  }

  /** Ingredients counted as available: in the inventory with no quantity or a quantity above 0. */
  async availableIngredientIds(): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ ingredient_id: string }>(
      'SELECT ingredient_id FROM inventory WHERE quantity IS NULL OR quantity > 0',
    );
    return rows.map((r) => r.ingredient_id);
  }

  /**
   * Runs the shared deterministic engine over local recipes (withdrawn ones excluded), exactly
   * like POST /recipes/match on the server, so results are identical online and offline.
   */
  async match(
    options: { ingredientIds?: string[]; includeIncomplete?: boolean; maxMissing?: number } = {},
  ): Promise<MatchView[]> {
    const available = options.ingredientIds ?? (await this.availableIngredientIds());
    const summaries = (await this.listRecipes()).filter((r) => !r.withdrawn);
    const lines = await this.db.getAllAsync<{
      recipe_id: string;
      ingredient_id: string;
      optional: number;
    }>('SELECT recipe_id, ingredient_id, optional FROM recipe_ingredients');
    const byRecipe = new Map<string, Array<{ ingredientId: string; optional: boolean }>>();
    for (const line of lines) {
      const list = byRecipe.get(line.recipe_id) ?? [];
      list.push({ ingredientId: line.ingredient_id, optional: toBool(line.optional) });
      byRecipe.set(line.recipe_id, list);
    }
    const substitutionRows = await this.db.getAllAsync<{
      ingredient_id: string;
      substitute_id: string;
      recipe_id: string | null;
      ratio: number;
      notes: string | null;
    }>('SELECT ingredient_id, substitute_id, recipe_id, ratio, notes FROM substitutions');

    const results = matchRecipes(
      summaries.map((r) => ({ id: r.id, name: r.name, ingredients: byRecipe.get(r.id) ?? [] })),
      available,
      substitutionRows.map((s) => ({
        ingredientId: s.ingredient_id,
        substituteId: s.substitute_id,
        recipeId: s.recipe_id,
        ratio: s.ratio,
      })),
      { includeIncomplete: options.includeIncomplete ?? true, maxMissing: options.maxMissing },
    );

    const names = new Map(
      (
        await this.db.getAllAsync<{ id: string; name: string }>('SELECT id, name FROM ingredients')
      ).map((i) => [i.id, i.name]),
    );
    const summaryById = new Map(summaries.map((s) => [s.id, s]));
    const ref = (id: string) => ({ id, name: names.get(id) ?? '' });
    const notes = (ingredientId: string, substituteId: string, recipeId: string) =>
      substitutionRows.find(
        (s) =>
          s.ingredient_id === ingredientId &&
          s.substitute_id === substituteId &&
          s.recipe_id === recipeId,
      )?.notes ??
      substitutionRows.find(
        (s) =>
          s.ingredient_id === ingredientId &&
          s.substitute_id === substituteId &&
          s.recipe_id === null,
      )?.notes ??
      null;

    return results.map((r) => ({
      recipe: summaryById.get(r.recipeId)!,
      classification: r.classification,
      missingRequired: r.missingRequired.map(ref),
      missingOptional: r.missingOptional.map(ref),
      substitutions: r.substitutions.map((s) => ({
        ingredientId: s.ingredientId,
        ingredientName: names.get(s.ingredientId) ?? '',
        substituteId: s.substituteId,
        substituteName: names.get(s.substituteId) ?? '',
        ratio: s.ratio,
        notes: notes(s.ingredientId, s.substituteId, r.recipeId),
      })),
    }));
  }

  private async idSet(sql: string, param: string): Promise<Set<string>> {
    return new Set((await this.db.getAllAsync<{ id: string }>(sql, param)).map((r) => r.id));
  }
}
