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
import { buildCatalog } from './catalog';

/**
 * Inserts the catalog built by buildCatalog() with its deterministic ids, so the server and the
 * catalog bundled in the mobile app share identifiers. Existing rows are left untouched.
 */
export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  const catalog = buildCatalog();

  for (const { id, ...category } of catalog.categories) {
    await prisma.category.upsert({
      where: { kind_name: { kind: category.kind, name: category.name } },
      create: { id, ...category },
      update: {},
    });
  }
  for (const { id, ...ingredient } of catalog.ingredients) {
    await prisma.ingredient.upsert({
      where: { name: ingredient.name },
      create: { id, ...ingredient },
      update: {},
    });
  }
  for (const { id, ...glass } of catalog.glassware) {
    await prisma.glassware.upsert({
      where: { name: glass.name },
      create: { id, ...glass },
      update: {},
    });
  }
  for (const { id, ...item } of catalog.equipment) {
    await prisma.equipment.upsert({
      where: { name: item.name },
      create: { id, ...item },
      update: {},
    });
  }
  for (const { id, equipmentIds, ...technique } of catalog.techniques) {
    await prisma.technique.upsert({
      where: { name: technique.name },
      create: {
        id,
        ...technique,
        equipment: { create: equipmentIds.map((equipmentId) => ({ equipmentId })) },
      },
      update: {},
    });
  }

  for (const { categoryIds, ingredients, steps, ...recipe } of catalog.recipes) {
    if (await prisma.recipe.findUnique({ where: { slug: recipe.slug }, select: { id: true } }))
      continue;
    await prisma.recipe.create({
      data: {
        ...recipe,
        verificationStatus: 'PUBLISHED',
        publishedAt: new Date(),
        ingredients: { create: ingredients },
        steps: { create: steps },
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });
  }

  for (const substitution of catalog.substitutions) {
    if (!(await prisma.ingredientSubstitution.findUnique({ where: { id: substitution.id } }))) {
      await prisma.ingredientSubstitution.create({ data: { ...substitution, approved: true } });
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
