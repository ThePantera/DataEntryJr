import { randomUUID } from 'node:crypto';
import { seedCatalog, type Catalog } from './fixtures';
import { API, createTestApp, resetDatabase, type TestContext } from './helpers';

describe('Asistente (motor de reglas, sin LLM en esta fase)', () => {
  let ctx: TestContext;
  let catalog: Catalog;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    catalog = await seedCatalog(ctx);
  });

  afterAll(() => ctx.app.close());

  it('recommends what can be prepared, explaining why, and declares that no LLM was used', async () => {
    const i = catalog.ingredients;
    const res = await ctx
      .http()
      .post(`${API}/ai/recommend`)
      .send({
        ingredientIds: [
          i.whiteRum.id,
          i.limeJuice.id,
          i.simpleSyrup.id,
          i.bourbon.id,
          i.lemonJuice.id,
        ],
      })
      .expect(200);

    expect(res.body).toMatchObject({ engine: 'RULES', llm: false });
    expect(res.body.recommendations.map((r: { recipeName: string }) => r.recipeName)).toEqual([
      'Daiquiri',
      'Whiskey Sour',
    ]);
    expect(res.body.recommendations[1].reasons).toEqual(
      expect.arrayContaining([expect.stringContaining('Jarabe simple')]),
    );
  });

  it('suggests recipes missing a single ingredient when nothing can be prepared yet', async () => {
    const i = catalog.ingredients;
    const res = await ctx
      .http()
      .post(`${API}/ai/recommend`)
      .send({ ingredientIds: [i.gin.id, i.campari.id] })
      .expect(200);
    expect(res.body.recommendations).toEqual([
      expect.objectContaining({
        recipeName: 'Negroni',
        classification: 'INCOMPLETE',
        reasons: [expect.stringContaining('Vermut rojo')],
      }),
    ]);
  });

  it('only offers approved substitutions', async () => {
    const res = await ctx
      .http()
      .post(`${API}/ai/substitute`)
      .send({ ingredientId: catalog.ingredients.limeJuice.id })
      .expect(200);
    expect(res.body.substitutions).toEqual([]);

    const gomme = await ctx
      .http()
      .post(`${API}/ai/substitute`)
      .send({ ingredientId: catalog.ingredients.gommeSyrup.id })
      .expect(200);
    expect(gomme.body.substitutions).toEqual([
      expect.objectContaining({
        substitute: expect.objectContaining({ name: 'Jarabe simple' }),
        scope: 'GLOBAL',
        ratio: 1,
      }),
    ]);
  });

  it('includes recipe-specific substitutions only for that recipe', async () => {
    const bourbon = catalog.ingredients.bourbon.id;
    const general = await ctx
      .http()
      .post(`${API}/ai/substitute`)
      .send({ ingredientId: bourbon })
      .expect(200);
    expect(general.body.substitutions).toEqual([]);

    const forSour = await ctx
      .http()
      .post(`${API}/ai/substitute`)
      .send({ ingredientId: bourbon, recipeId: catalog.recipes.whiskeySour.id })
      .expect(200);
    expect(forSour.body.substitutions).toEqual([
      expect.objectContaining({
        substitute: expect.objectContaining({ name: 'Whiskey de centeno' }),
        scope: 'RECIPE',
      }),
    ]);
  });

  it('explains a technique from its verified content', async () => {
    const res = await ctx
      .http()
      .post(`${API}/ai/explain`)
      .send({ techniqueId: catalog.techniques.shake.id })
      .expect(200);
    expect(res.body).toMatchObject({
      engine: 'RULES',
      llm: false,
      topic: 'TECHNIQUE',
      title: 'Batido',
      commonMistakes: ['Agitar con poco hielo', 'Agitar demasiado tiempo'],
      equipment: ['Coctelera', 'Colador Hawthorne'],
    });
  });

  it('explains a recipe step together with its technique', async () => {
    const res = await ctx
      .http()
      .post(`${API}/ai/explain`)
      .send({ recipeId: catalog.recipes.daiquiri.id, stepNumber: 2 })
      .expect(200);
    expect(res.body).toMatchObject({
      topic: 'RECIPE_STEP',
      title: 'Daiquiri — paso 2',
      step: { stepNumber: 2, instruction: 'Aplicar la técnica y servir.' },
      technique: expect.objectContaining({ name: 'Batido' }),
    });
  });

  it('validates explain requests and hides unpublished recipes', async () => {
    await ctx.http().post(`${API}/ai/explain`).send({}).expect(400);
    await ctx
      .http()
      .post(`${API}/ai/explain`)
      .send({ techniqueId: catalog.techniques.shake.id, recipeId: catalog.recipes.daiquiri.id })
      .expect(400);
    await ctx
      .http()
      .post(`${API}/ai/explain`)
      .send({ recipeId: catalog.recipes.manhattan.id })
      .expect(404);
    await ctx
      .http()
      .post(`${API}/ai/explain`)
      .send({ recipeId: catalog.recipes.daiquiri.id, stepNumber: 9 })
      .expect(404);
    await ctx.http().post(`${API}/ai/substitute`).send({ ingredientId: randomUUID() }).expect(404);
  });
});
