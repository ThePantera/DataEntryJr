import type { PrismaClient } from '@prisma/client';
import { seedDatabase } from '../../prisma/seed';
import { getPublicationIssues } from '../../src/recipes/recipe-workflow';
import { createTestApp, resetDatabase, type TestContext } from './helpers';

describe('Seed de desarrollo', () => {
  let ctx: TestContext;
  let prisma: PrismaClient;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.prisma;
    await resetDatabase(ctx.prisma);
    await seedDatabase(prisma);
  });

  afterAll(() => ctx.app.close());

  it('only publishes recipes that meet the publication requirements', async () => {
    const recipes = await prisma.recipe.findMany({
      where: { verificationStatus: 'PUBLISHED' },
      include: { ingredients: true, steps: true },
    });
    expect(recipes.length).toBeGreaterThanOrEqual(7);
    for (const recipe of recipes) {
      const issues = getPublicationIssues({
        ...recipe,
        ingredients: recipe.ingredients.map((i) => ({
          ...i,
          quantity: i.quantity?.toNumber() ?? null,
        })),
        stepCount: recipe.steps.length,
      });
      expect({ recipe: recipe.slug, issues }).toEqual({ recipe: recipe.slug, issues: [] });
    }
  });

  it('is idempotent and does not bump versions when run again', async () => {
    const snapshot = async () => ({
      recipes: await prisma.recipe.count(),
      ingredients: await prisma.ingredient.count(),
      substitutions: await prisma.ingredientSubstitution.count(),
      manifest: await prisma.downloadManifest.findMany({ orderBy: { resourceId: 'asc' } }),
    });
    const before = await snapshot();
    await seedDatabase(prisma);
    expect(await snapshot()).toEqual(before);
  });

  it('announces every published resource in the download manifest', async () => {
    const published = await prisma.recipe.count({ where: { verificationStatus: 'PUBLISHED' } });
    const manifestRecipes = await prisma.downloadManifest.count({
      where: { resourceType: 'RECIPE', deleted: false },
    });
    expect(manifestRecipes).toBe(published);
  });
});
