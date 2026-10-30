/**
 * Catálogo inicial de DESARROLLO (no es el catálogo editorial de la Fase 5).
 *
 * Las recetas siguen las especificaciones de los IBA Official Cocktails. Solo se incluyen
 * clásicos cuyas cantidades la IBA expresa con números; las recetas con medidas imprecisas
 * (p. ej. "unos golpes" en el Old Fashioned) quedan fuera hasta una decisión editorial.
 * Las graduaciones alcohólicas son valores típicos y varían según la marca.
 */
import type { Allergen, CategoryKind, Difficulty, IceType, Unit } from '@prisma/client';

export const SEED_SOURCE = 'IBA Official Cocktails (iba-world.com)';

export const categories: Array<{ name: string; kind: CategoryKind; description?: string }> = [
  { name: 'Destilados', kind: 'INGREDIENT' },
  { name: 'Licores', kind: 'INGREDIENT' },
  { name: 'Vermuts y aperitivos', kind: 'INGREDIENT' },
  { name: 'Amargos', kind: 'INGREDIENT' },
  { name: 'Jugos y cítricos', kind: 'INGREDIENT' },
  { name: 'Endulzantes', kind: 'INGREDIENT' },
  { name: 'Hierbas', kind: 'INGREDIENT' },
  { name: 'Mezcladores', kind: 'INGREDIENT' },
  { name: 'Otros', kind: 'INGREDIENT' },
  { name: 'IBA: The Unforgettables', kind: 'RECIPE', description: 'Categoría oficial de la IBA.' },
  {
    name: 'IBA: Contemporary Classics',
    kind: 'RECIPE',
    description: 'Categoría oficial de la IBA.',
  },
  { name: 'Sours', kind: 'RECIPE', description: 'Destilado, cítrico y endulzante.' },
  {
    name: 'Spirit-forward',
    kind: 'RECIPE',
    description: 'Predominio del destilado; sin cítricos.',
  },
  { name: 'Highballs', kind: 'RECIPE', description: 'Servidos largos con un mezclador.' },
];

export const ingredients: Array<{
  name: string;
  category: string;
  alcoholPercentage?: number;
  description?: string;
  allergens?: Allergen[];
}> = [
  { name: 'Gin', category: 'Destilados', alcoholPercentage: 40 },
  { name: 'Ron blanco', category: 'Destilados', alcoholPercentage: 40 },
  { name: 'Tequila 100% agave', category: 'Destilados', alcoholPercentage: 40 },
  { name: 'Bourbon', category: 'Destilados', alcoholPercentage: 40 },
  {
    name: 'Whiskey de centeno',
    category: 'Destilados',
    alcoholPercentage: 40,
    description: 'Rye whiskey.',
  },
  {
    name: 'Triple sec',
    category: 'Licores',
    alcoholPercentage: 40,
    description: 'Licor de naranja.',
  },
  { name: 'Campari', category: 'Vermuts y aperitivos', alcoholPercentage: 25 },
  {
    name: 'Vermut rojo',
    category: 'Vermuts y aperitivos',
    alcoholPercentage: 16,
    description: 'Vermut dulce (rosso).',
    allergens: ['SULPHITES'],
  },
  { name: 'Amargo de Angostura', category: 'Amargos', alcoholPercentage: 44.7 },
  { name: 'Jugo de lima', category: 'Jugos y cítricos', description: 'Recién exprimido.' },
  { name: 'Jugo de limón', category: 'Jugos y cítricos', description: 'Recién exprimido.' },
  { name: 'Jarabe simple', category: 'Endulzantes', description: 'Azúcar y agua.' },
  { name: 'Azúcar extrafina', category: 'Endulzantes' },
  { name: 'Azúcar blanca de caña', category: 'Endulzantes' },
  { name: 'Menta', category: 'Hierbas', description: 'Hojas frescas (hierbabuena).' },
  { name: 'Agua con gas', category: 'Mezcladores', description: 'Soda.' },
];

export const glassware = [
  { name: 'Copa de cóctel', description: 'Copa con pie para tragos servidos sin hielo.' },
  { name: 'Vaso old fashioned', description: 'Vaso bajo (rocks).' },
  { name: 'Vaso highball', description: 'Vaso alto para tragos largos.' },
];

export const equipment = [
  { name: 'Coctelera', description: 'Para batir con hielo.' },
  { name: 'Colador Hawthorne', description: 'Colador con resorte.' },
  { name: 'Vaso mezclador', description: 'Para remover con hielo.' },
  { name: 'Cuchara de bar', description: 'Cuchara de mango largo.' },
  { name: 'Colador julep', description: 'Colador perforado para vaso mezclador.' },
  { name: 'Medidor (jigger)', description: 'Para medir cantidades.' },
  { name: 'Majador', description: 'Para macerar frutas y hierbas.' },
];

export const techniques: Array<{
  name: string;
  description: string;
  durationSeconds?: number;
  instructions: string;
  commonMistakes: string[];
  equipment: string[];
}> = [
  {
    name: 'Batido',
    description:
      'Agitar los ingredientes con hielo para enfriar, diluir y airear. Habitualmente entre 10 y 15 segundos.',
    durationSeconds: 15,
    instructions:
      'Medir los ingredientes en la coctelera, llenarla de hielo, cerrarla bien y agitar con energía. Colar en el vaso.',
    commonMistakes: [
      'Usar poco hielo, lo que diluye de más y enfría de menos.',
      'No cerrar bien la coctelera.',
      'Batir tragos que solo llevan destilados y modificadores, que suelen removerse.',
    ],
    equipment: ['Coctelera', 'Colador Hawthorne', 'Medidor (jigger)'],
  },
  {
    name: 'Refrescado (removido)',
    description:
      'Remover con hielo en el vaso mezclador para enfriar y diluir sin airear. Habitualmente entre 20 y 30 segundos.',
    durationSeconds: 30,
    instructions:
      'Medir los ingredientes en el vaso mezclador, llenarlo de hielo y remover con la cuchara de bar. Colar en el vaso frío.',
    commonMistakes: [
      'Remover con poco hielo.',
      'Remover demasiado y diluir en exceso.',
      'No enfriar previamente el vaso de servicio.',
    ],
    equipment: ['Vaso mezclador', 'Cuchara de bar', 'Colador julep', 'Medidor (jigger)'],
  },
  {
    name: 'Directo',
    description: 'Construir el trago directamente en el vaso de servicio.',
    instructions:
      'Llenar el vaso con hielo, verter los ingredientes y remover suavemente para integrarlos.',
    commonMistakes: [
      'No remover, dejando los ingredientes sin integrar.',
      'Usar hielo de mala calidad.',
    ],
    equipment: ['Cuchara de bar', 'Medidor (jigger)'],
  },
  {
    name: 'Macerado',
    description: 'Presionar hierbas, frutas o azúcar para extraer aromas y jugos.',
    instructions:
      'Presionar suavemente con el majador en el fondo del vaso; no triturar las hierbas.',
    commonMistakes: ['Triturar la menta, lo que libera amargor.', 'Usar un majador barnizado.'],
    equipment: ['Majador', 'Cuchara de bar'],
  },
];

export interface SeedRecipe {
  name: string;
  slug: string;
  description: string;
  difficulty: Difficulty;
  technique: string;
  glassware: string;
  iceType: IceType;
  garnish?: string;
  instructions: string;
  categories: string[];
  ingredients: Array<{ name: string; quantity: number | null; unit: Unit; optional?: boolean }>;
  steps: string[];
}

export const recipes: SeedRecipe[] = [
  {
    name: 'Negroni',
    slug: 'negroni',
    description: 'Partes iguales de gin, Campari y vermut rojo.',
    difficulty: 'EASY',
    technique: 'Directo',
    glassware: 'Vaso old fashioned',
    iceType: 'CUBED',
    garnish: 'Media rodaja de naranja',
    instructions:
      'Verter todos los ingredientes en un vaso old fashioned con hielo y remover suavemente.',
    categories: ['IBA: The Unforgettables', 'Spirit-forward'],
    ingredients: [
      { name: 'Gin', quantity: 30, unit: 'ML' },
      { name: 'Campari', quantity: 30, unit: 'ML' },
      { name: 'Vermut rojo', quantity: 30, unit: 'ML' },
    ],
    steps: [
      'Llenar un vaso old fashioned con hielo.',
      'Verter el gin, el Campari y el vermut rojo.',
      'Remover suavemente.',
      'Decorar con media rodaja de naranja.',
    ],
  },
  {
    name: 'Daiquiri',
    slug: 'daiquiri',
    description: 'Ron blanco, lima y azúcar.',
    difficulty: 'EASY',
    technique: 'Batido',
    glassware: 'Copa de cóctel',
    iceType: 'NONE',
    instructions:
      'Disolver el azúcar en la coctelera con el ron y la lima, batir con hielo y colar en copa fría.',
    categories: ['IBA: The Unforgettables', 'Sours'],
    ingredients: [
      { name: 'Ron blanco', quantity: 60, unit: 'ML' },
      { name: 'Jugo de lima', quantity: 20, unit: 'ML' },
      { name: 'Azúcar extrafina', quantity: 2, unit: 'BARSPOON' },
    ],
    steps: [
      'Poner todos los ingredientes en la coctelera y remover para disolver el azúcar.',
      'Añadir hielo y batir.',
      'Colar en una copa de cóctel fría.',
    ],
  },
  {
    name: 'Margarita',
    slug: 'margarita',
    description: 'Tequila, triple sec y lima.',
    difficulty: 'MEDIUM',
    technique: 'Batido',
    glassware: 'Copa de cóctel',
    iceType: 'NONE',
    garnish: 'Media corona de sal (opcional)',
    instructions: 'Batir todos los ingredientes con hielo y colar en copa fría.',
    categories: ['IBA: Contemporary Classics', 'Sours'],
    ingredients: [
      { name: 'Tequila 100% agave', quantity: 50, unit: 'ML' },
      { name: 'Triple sec', quantity: 20, unit: 'ML' },
      { name: 'Jugo de lima', quantity: 15, unit: 'ML' },
    ],
    steps: [
      'Si se desea, escarchar con sal la mitad del borde de la copa.',
      'Batir todos los ingredientes con hielo.',
      'Colar en la copa fría.',
    ],
  },
  {
    name: 'Manhattan',
    slug: 'manhattan',
    description: 'Whiskey de centeno, vermut rojo y amargo de Angostura.',
    difficulty: 'MEDIUM',
    technique: 'Refrescado (removido)',
    glassware: 'Copa de cóctel',
    iceType: 'NONE',
    garnish: 'Cereza de cóctel',
    instructions: 'Remover con hielo en el vaso mezclador y colar en copa fría.',
    categories: ['IBA: The Unforgettables', 'Spirit-forward'],
    ingredients: [
      { name: 'Whiskey de centeno', quantity: 50, unit: 'ML' },
      { name: 'Vermut rojo', quantity: 20, unit: 'ML' },
      { name: 'Amargo de Angostura', quantity: 1, unit: 'DASH' },
    ],
    steps: [
      'Verter todos los ingredientes en el vaso mezclador con hielo.',
      'Remover bien.',
      'Colar en una copa de cóctel fría.',
      'Decorar con una cereza de cóctel.',
    ],
  },
  {
    name: 'Mojito',
    slug: 'mojito',
    description: 'Ron blanco, lima, menta, azúcar y soda.',
    difficulty: 'MEDIUM',
    technique: 'Macerado',
    glassware: 'Vaso highball',
    iceType: 'CRUSHED',
    garnish: 'Rama de menta',
    instructions:
      'Macerar la menta con el azúcar y la lima, añadir hielo picado y el ron, y completar con soda.',
    categories: ['IBA: Contemporary Classics', 'Highballs'],
    ingredients: [
      { name: 'Ron blanco', quantity: 45, unit: 'ML' },
      { name: 'Jugo de lima', quantity: 20, unit: 'ML' },
      { name: 'Menta', quantity: 6, unit: 'SPRIG' },
      { name: 'Azúcar blanca de caña', quantity: 2, unit: 'TEASPOON' },
      { name: 'Agua con gas', quantity: null, unit: 'TOP_UP' },
    ],
    steps: [
      'Macerar suavemente la menta con el azúcar y el jugo de lima en el vaso.',
      'Añadir un chorro de soda y llenar el vaso con hielo picado.',
      'Verter el ron y completar con soda.',
      'Decorar con una rama de menta y servir con pajita.',
    ],
  },
  {
    name: 'Whiskey Sour',
    slug: 'whiskey-sour',
    description: 'Bourbon, limón y jarabe. La IBA admite clara de huevo opcional.',
    difficulty: 'MEDIUM',
    technique: 'Batido',
    glassware: 'Vaso old fashioned',
    iceType: 'CUBED',
    garnish: 'Media rodaja de naranja y cereza',
    instructions: 'Batir con hielo y colar en vaso old fashioned con hielo.',
    categories: ['IBA: The Unforgettables', 'Sours'],
    ingredients: [
      { name: 'Bourbon', quantity: 45, unit: 'ML' },
      { name: 'Jugo de limón', quantity: 25, unit: 'ML' },
      { name: 'Jarabe simple', quantity: 20, unit: 'ML' },
    ],
    steps: [
      'Batir todos los ingredientes con hielo.',
      'Colar en un vaso old fashioned con hielo.',
      'Decorar con media rodaja de naranja y una cereza.',
    ],
  },
  {
    name: 'Americano',
    slug: 'americano',
    description: 'Campari y vermut rojo, alargado con soda.',
    difficulty: 'EASY',
    technique: 'Directo',
    glassware: 'Vaso old fashioned',
    iceType: 'CUBED',
    garnish: 'Media rodaja de naranja y piel de limón',
    instructions: 'Construir sobre hielo y completar con un chorro de soda.',
    categories: ['IBA: The Unforgettables', 'Highballs'],
    ingredients: [
      { name: 'Campari', quantity: 30, unit: 'ML' },
      { name: 'Vermut rojo', quantity: 30, unit: 'ML' },
      { name: 'Agua con gas', quantity: null, unit: 'TOP_UP' },
    ],
    steps: [
      'Verter el Campari y el vermut en un vaso con hielo.',
      'Completar con un chorro de soda.',
      'Decorar con media rodaja de naranja y piel de limón.',
    ],
  },
];

/** Sustituciones aprobadas de muestra. */
export const substitutions: Array<{
  ingredient: string;
  substitute: string;
  recipeSlug?: string;
  ratio: number;
  notes: string;
}> = [
  {
    ingredient: 'Whiskey de centeno',
    substitute: 'Bourbon',
    recipeSlug: 'manhattan',
    ratio: 1,
    notes: 'Variante habitual; resulta un trago más dulce y redondo.',
  },
];
