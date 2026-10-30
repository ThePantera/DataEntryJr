import type { PrismaService } from '../../src/prisma/prisma.service';
import { ManifestService } from '../../src/manifest/manifest.service';
import type { TestContext } from './helpers';

/**
 * Small, deterministic catalog for e2e tests (not the development seed).
 * Published: Daiquiri, Negroni, Whiskey Sour (classics) and "Jardín de Pruebas" (original).
 * Not public: Manhattan (DRAFT).
 */
export async function seedCatalog(ctx: TestContext) {
  const prisma: PrismaService = ctx.prisma;

  const spirits = await prisma.category.create({
    data: { name: 'Destilados', kind: 'INGREDIENT' },
  });
  const modifiers = await prisma.category.create({
    data: { name: 'Modificadores', kind: 'INGREDIENT' },
  });
  const sours = await prisma.category.create({ data: { name: 'Sours', kind: 'RECIPE' } });
  const stirred = await prisma.category.create({
    data: { name: 'Spirit-forward', kind: 'RECIPE' },
  });

  const ingredient = (
    name: string,
    categoryId: string,
    abv = 0,
    allergens: ('EGGS' | 'SULPHITES')[] = [],
  ) => prisma.ingredient.create({ data: { name, categoryId, alcoholPercentage: abv, allergens } });

  const i = {
    whiteRum: await ingredient('Ron blanco', spirits.id, 40),
    gin: await ingredient('Gin', spirits.id, 40),
    bourbon: await ingredient('Bourbon', spirits.id, 45),
    rye: await ingredient('Whiskey de centeno', spirits.id, 45),
    campari: await ingredient('Campari', modifiers.id, 25),
    sweetVermouth: await ingredient('Vermut rojo', modifiers.id, 16, ['SULPHITES']),
    limeJuice: await ingredient('Jugo de lima', modifiers.id),
    lemonJuice: await ingredient('Jugo de limón', modifiers.id),
    simpleSyrup: await ingredient('Jarabe simple', modifiers.id),
    gommeSyrup: await ingredient('Jarabe de goma', modifiers.id),
    eggWhite: await ingredient('Clara de huevo', modifiers.id, 0, ['EGGS']),
    angostura: await ingredient('Amargo de Angostura', modifiers.id, 44.7),
    soda: await ingredient('Agua con gas', modifiers.id),
  };

  const coupe = await prisma.glassware.create({ data: { name: 'Copa coupé', capacityMl: 180 } });
  const rocks = await prisma.glassware.create({
    data: { name: 'Vaso old fashioned', capacityMl: 300 },
  });
  const shaker = await prisma.equipment.create({ data: { name: 'Coctelera' } });
  const strainer = await prisma.equipment.create({ data: { name: 'Colador Hawthorne' } });
  const mixingGlass = await prisma.equipment.create({ data: { name: 'Vaso mezclador' } });

  const shake = await prisma.technique.create({
    data: {
      name: 'Batido',
      description: 'Agitar con hielo para enfriar, diluir y airear.',
      durationSeconds: 12,
      instructions: 'Llenar la coctelera con hielo, cerrar y agitar con energía.',
      commonMistakes: ['Agitar con poco hielo', 'Agitar demasiado tiempo'],
      equipment: { create: [{ equipmentId: shaker.id }, { equipmentId: strainer.id }] },
    },
  });
  const stir = await prisma.technique.create({
    data: {
      name: 'Refrescado',
      description: 'Remover con hielo para enfriar y diluir sin airear.',
      durationSeconds: 30,
      instructions: 'Remover con cuchara de bar en el vaso mezclador lleno de hielo.',
      equipment: { create: [{ equipmentId: mixingGlass.id }] },
    },
  });

  type Line = [string, number | null, 'ML' | 'DASH' | 'TOP_UP' | 'BARSPOON', boolean?];
  const recipe = (data: {
    name: string;
    slug: string;
    techniqueId: string;
    glasswareId: string;
    status: 'DRAFT' | 'PUBLISHED';
    origin?: 'CLASSIC' | 'ORIGINAL';
    categoryIds: string[];
    lines: Line[];
  }) =>
    prisma.recipe.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: `${data.name} (fixture)`,
        difficulty: 'EASY',
        techniqueId: data.techniqueId,
        glasswareId: data.glasswareId,
        iceType: 'NONE',
        source: data.origin === 'ORIGINAL' ? null : 'IBA Official Cocktails',
        origin: data.origin ?? 'CLASSIC',
        verificationStatus: data.status,
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        instructions: 'Preparar según los pasos.',
        ingredients: {
          create: data.lines.map(([ingredientId, quantity, unit, optional], position) => ({
            ingredientId,
            quantity,
            unit,
            optional: optional ?? false,
            position,
          })),
        },
        steps: {
          create: [
            { stepNumber: 1, instruction: 'Medir los ingredientes.' },
            { stepNumber: 2, instruction: 'Aplicar la técnica y servir.', durationSeconds: 15 },
          ],
        },
        categories: { create: data.categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });

  const daiquiri = await recipe({
    name: 'Daiquiri',
    slug: 'daiquiri',
    techniqueId: shake.id,
    glasswareId: coupe.id,
    status: 'PUBLISHED',
    categoryIds: [sours.id],
    lines: [
      [i.whiteRum.id, 60, 'ML'],
      [i.limeJuice.id, 20, 'ML'],
      [i.simpleSyrup.id, 15, 'ML'],
    ],
  });
  const negroni = await recipe({
    name: 'Negroni',
    slug: 'negroni',
    techniqueId: stir.id,
    glasswareId: rocks.id,
    status: 'PUBLISHED',
    categoryIds: [stirred.id],
    lines: [
      [i.gin.id, 30, 'ML'],
      [i.campari.id, 30, 'ML'],
      [i.sweetVermouth.id, 30, 'ML'],
    ],
  });
  const whiskeySour = await recipe({
    name: 'Whiskey Sour',
    slug: 'whiskey-sour',
    techniqueId: shake.id,
    glasswareId: rocks.id,
    status: 'PUBLISHED',
    categoryIds: [sours.id],
    lines: [
      [i.bourbon.id, 45, 'ML'],
      [i.lemonJuice.id, 25, 'ML'],
      [i.gommeSyrup.id, 20, 'ML'],
      [i.eggWhite.id, 1, 'DASH', true],
    ],
  });
  const manhattan = await recipe({
    name: 'Manhattan',
    slug: 'manhattan',
    techniqueId: stir.id,
    glasswareId: coupe.id,
    status: 'DRAFT',
    categoryIds: [stirred.id],
    lines: [
      [i.rye.id, 50, 'ML'],
      [i.sweetVermouth.id, 20, 'ML'],
      [i.angostura.id, 1, 'DASH'],
    ],
  });
  const original = await recipe({
    name: 'Jardín de Pruebas',
    slug: 'jardin-de-pruebas',
    techniqueId: shake.id,
    glasswareId: coupe.id,
    status: 'PUBLISHED',
    origin: 'ORIGINAL',
    categoryIds: [],
    lines: [
      [i.gin.id, 45, 'ML'],
      [i.limeJuice.id, 20, 'ML'],
      [i.simpleSyrup.id, 15, 'ML'],
      [i.soda.id, null, 'TOP_UP'],
    ],
  });

  await prisma.ingredientSubstitution.createMany({
    data: [
      // Approved, global: simple syrup can replace gomme syrup 1:1.
      { ingredientId: i.gommeSyrup.id, substituteId: i.simpleSyrup.id, ratio: 1, approved: true },
      // Approved, only for the Whiskey Sour: rye can replace bourbon.
      {
        ingredientId: i.bourbon.id,
        substituteId: i.rye.id,
        recipeId: whiskeySour.id,
        ratio: 1,
        approved: true,
      },
      // Not approved: must be ignored by the matching engine.
      { ingredientId: i.limeJuice.id, substituteId: i.lemonJuice.id, ratio: 1, approved: false },
    ],
  });

  await ctx.app.get(ManifestService).rebuild();

  return {
    categories: { spirits, modifiers, sours, stirred },
    ingredients: i,
    glassware: { coupe, rocks },
    equipment: { shaker, strainer, mixingGlass },
    techniques: { shake, stir },
    recipes: { daiquiri, negroni, whiskeySour, manhattan, original },
  };
}

export type Catalog = Awaited<ReturnType<typeof seedCatalog>>;
