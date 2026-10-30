import type { CatalogBundle, CatalogRecipe } from '@bartender-lab/shared';
import { catalogId } from './catalog-ids';
import * as data from './seed-data';

function lookup(ids: Map<string, string>, name: string, what: string): string {
  const id = ids.get(name);
  if (!id) throw new Error(`Catalog data error: unknown ${what} "${name}"`);
  return id;
}

/**
 * Builds the initial catalog with deterministic ids from seed-data.ts.
 * It is the single source for both the server seed and the catalog bundled in the mobile app.
 */
export function buildCatalog(): CatalogBundle {
  const categories = data.categories.map((c) => ({
    id: catalogId(`category:${c.kind}:${c.name}`),
    name: c.name,
    description: c.description ?? null,
    kind: c.kind,
    version: 1,
  }));
  const categoryIds = new Map(categories.map((c) => [`${c.kind}:${c.name}`, c.id]));

  const ingredients = data.ingredients.map((i) => ({
    id: catalogId(`ingredient:${i.name}`),
    name: i.name,
    description: i.description ?? null,
    categoryId: lookup(categoryIds, `INGREDIENT:${i.category}`, 'ingredient category'),
    alcoholPercentage: i.alcoholPercentage ?? 0,
    imageUrl: null,
    allergens: i.allergens ?? [],
    version: 1,
  }));
  const ingredientIds = new Map(ingredients.map((i) => [i.name, i.id]));

  const glassware = data.glassware.map((g) => ({
    id: catalogId(`glassware:${g.name}`),
    name: g.name,
    description: g.description ?? null,
    capacityMl: null,
    imageUrl: null,
    version: 1,
  }));
  const glasswareIds = new Map(glassware.map((g) => [g.name, g.id]));

  const equipment = data.equipment.map((e) => ({
    id: catalogId(`equipment:${e.name}`),
    name: e.name,
    description: e.description ?? null,
    imageUrl: null,
    version: 1,
  }));
  const equipmentIds = new Map(equipment.map((e) => [e.name, e.id]));

  const techniques = data.techniques.map((t) => ({
    id: catalogId(`technique:${t.name}`),
    name: t.name,
    description: t.description,
    durationSeconds: t.durationSeconds ?? null,
    instructions: t.instructions,
    commonMistakes: t.commonMistakes,
    equipmentIds: t.equipment.map((name) => lookup(equipmentIds, name, 'equipment')),
    version: 1,
  }));
  const techniqueIds = new Map(techniques.map((t) => [t.name, t.id]));

  const recipes: CatalogRecipe[] = data.recipes.map((r) => ({
    id: catalogId(`recipe:${r.slug}`),
    name: r.name,
    slug: r.slug,
    description: r.description,
    history: null,
    difficulty: r.difficulty,
    preparationTimeSeconds: null,
    servings: 1,
    glasswareId: lookup(glasswareIds, r.glassware, 'glassware'),
    techniqueId: lookup(techniqueIds, r.technique, 'technique'),
    iceType: r.iceType,
    garnish: r.garnish ?? null,
    alcoholPercentageEstimated: null,
    instructions: r.instructions,
    imageUrl: null,
    source: data.SEED_SOURCE,
    origin: 'CLASSIC',
    version: 1,
    categoryIds: r.categories.map((name) =>
      lookup(categoryIds, `RECIPE:${name}`, 'recipe category'),
    ),
    ingredients: r.ingredients.map((line, position) => ({
      id: catalogId(`recipe-ingredient:${r.slug}:${line.name}`),
      ingredientId: lookup(ingredientIds, line.name, 'ingredient'),
      quantity: line.quantity,
      unit: line.unit,
      optional: line.optional ?? false,
      position,
    })),
    steps: r.steps.map((instruction, index) => ({
      id: catalogId(`recipe-step:${r.slug}:${index + 1}`),
      stepNumber: index + 1,
      instruction,
      durationSeconds: null,
      imageUrl: null,
    })),
  }));
  const recipeIds = new Map(recipes.map((r) => [r.slug, r.id]));

  const substitutions = data.substitutions.map((s) => ({
    id: catalogId(`substitution:${s.ingredient}:${s.substitute}:${s.recipeSlug ?? '*'}`),
    ingredientId: lookup(ingredientIds, s.ingredient, 'ingredient'),
    substituteId: lookup(ingredientIds, s.substitute, 'ingredient'),
    recipeId: s.recipeSlug ? lookup(recipeIds, s.recipeSlug, 'recipe') : null,
    ratio: s.ratio,
    notes: s.notes,
  }));

  return {
    formatVersion: 1,
    categories,
    ingredients,
    glassware,
    equipment,
    techniques,
    recipes,
    substitutions,
  };
}
