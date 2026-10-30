/**
 * Seed de desarrollo. Idempotente: solo inserta lo que falta y nunca sobrescribe cambios
 * editoriales hechos desde la API. Uso: npm run db:seed -w @bartender-lab/api
 *
 * Opcional: SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD crean (o promueven) un administrador.
 */
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { PasswordHasher } from '../src/auth/password-hasher';
import { rebuildManifest } from '../src/manifest/manifest-store';
import * as data from './seed-data';

function byName<T extends { id: string; name: string }>(rows: T[]): Map<string, T> {
  return new Map(rows.map((row) => [row.name, row]));
}

function required<T>(map: Map<string, T>, name: string, what: string): T {
  const value = map.get(name);
  if (!value) throw new Error(`Seed data error: unknown ${what} "${name}"`);
  return value;
}

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  for (const category of data.categories) {
    await prisma.category.upsert({
      where: { kind_name: { kind: category.kind, name: category.name } },
      create: category,
      update: {},
    });
  }
  const ingredientCategories = byName(
    await prisma.category.findMany({ where: { kind: 'INGREDIENT' } }),
  );
  const recipeCategories = byName(await prisma.category.findMany({ where: { kind: 'RECIPE' } }));

  for (const { category, ...ingredient } of data.ingredients) {
    await prisma.ingredient.upsert({
      where: { name: ingredient.name },
      create: {
        ...ingredient,
        categoryId: required(ingredientCategories, category, 'category').id,
      },
      update: {},
    });
  }
  for (const glass of data.glassware) {
    await prisma.glassware.upsert({ where: { name: glass.name }, create: glass, update: {} });
  }
  for (const item of data.equipment) {
    await prisma.equipment.upsert({ where: { name: item.name }, create: item, update: {} });
  }
  const equipment = byName(await prisma.equipment.findMany());
  for (const { equipment: tools, ...technique } of data.techniques) {
    await prisma.technique.upsert({
      where: { name: technique.name },
      create: {
        ...technique,
        equipment: {
          create: tools.map((name) => ({ equipmentId: required(equipment, name, 'equipment').id })),
        },
      },
      update: {},
    });
  }

  const ingredients = byName(await prisma.ingredient.findMany());
  const glassware = byName(await prisma.glassware.findMany());
  const techniques = byName(await prisma.technique.findMany());

  for (const recipe of data.recipes) {
    if (await prisma.recipe.findUnique({ where: { slug: recipe.slug }, select: { id: true } }))
      continue;
    await prisma.recipe.create({
      data: {
        name: recipe.name,
        slug: recipe.slug,
        description: recipe.description,
        difficulty: recipe.difficulty,
        techniqueId: required(techniques, recipe.technique, 'technique').id,
        glasswareId: required(glassware, recipe.glassware, 'glassware').id,
        iceType: recipe.iceType,
        garnish: recipe.garnish,
        instructions: recipe.instructions,
        source: data.SEED_SOURCE,
        origin: 'CLASSIC',
        verificationStatus: 'PUBLISHED',
        publishedAt: new Date(),
        ingredients: {
          create: recipe.ingredients.map((line, position) => ({
            ingredientId: required(ingredients, line.name, 'ingredient').id,
            quantity: line.quantity,
            unit: line.unit,
            optional: line.optional ?? false,
            position,
          })),
        },
        steps: {
          create: recipe.steps.map((instruction, index) => ({
            stepNumber: index + 1,
            instruction,
          })),
        },
        categories: {
          create: recipe.categories.map((name) => ({
            categoryId: required(recipeCategories, name, 'recipe category').id,
          })),
        },
      },
    });
  }

  for (const sub of data.substitutions) {
    const ingredientId = required(ingredients, sub.ingredient, 'ingredient').id;
    const substituteId = required(ingredients, sub.substitute, 'ingredient').id;
    const recipeId = sub.recipeSlug
      ? (await prisma.recipe.findUniqueOrThrow({ where: { slug: sub.recipeSlug } })).id
      : null;
    const exists = await prisma.ingredientSubstitution.findFirst({
      where: { ingredientId, substituteId, recipeId },
    });
    if (!exists) {
      await prisma.ingredientSubstitution.create({
        data: {
          ingredientId,
          substituteId,
          recipeId,
          ratio: sub.ratio,
          notes: sub.notes,
          approved: true,
        },
      });
    }
  }

  await rebuildManifest(prisma);
}

async function ensureAdmin(prisma: PrismaClient): Promise<void> {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) throw new Error('SEED_ADMIN_PASSWORD must have at least 12 characters');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
    return;
  }
  const hasher = new PasswordHasher(Number(process.env.PASSWORD_HASH_COST ?? 17));
  await prisma.user.create({
    data: { email, displayName: 'Admin', role: 'ADMIN', passwordHash: await hasher.hash(password) },
  });
}

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const prisma = new PrismaClient();
  try {
    await seedDatabase(prisma);
    await ensureAdmin(prisma);
    const [recipes, ingredients] = await Promise.all([
      prisma.recipe.count(),
      prisma.ingredient.count(),
    ]);
    console.log(`Seed complete: ${recipes} recipes, ${ingredients} ingredients.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
