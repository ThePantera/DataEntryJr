import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateOpenApiDocument } from '../../src/openapi';
import { API, createTestApp, type TestContext } from './helpers';

/** Every endpoint of section 6 of the technical document (prefix /api/v1). */
const REQUIRED_ENDPOINTS: Array<[string, string]> = [
  ['get', '/ingredients'],
  ['get', '/ingredients/{id}'],
  ['post', '/ingredients'],
  ['patch', '/ingredients/{id}'],
  ['get', '/recipes'],
  ['get', '/recipes/{id}'],
  ['get', '/recipes/categories'],
  ['post', '/recipes/match'],
  ['get', '/recipes/{id}/ingredients'],
  ['get', '/recipes/{id}/steps'],
  ['get', '/inventory'],
  ['post', '/inventory'],
  ['patch', '/inventory/{id}'],
  ['delete', '/inventory/{id}'],
  ['get', '/techniques'],
  ['get', '/techniques/{id}'],
  ['get', '/favorites'],
  ['post', '/favorites/{recipeId}'],
  ['delete', '/favorites/{recipeId}'],
  ['get', '/sync/manifest'],
  ['get', '/sync/changes'],
  ['post', '/sync/push'],
  ['post', '/ai/recommend'],
  ['post', '/ai/substitute'],
  ['post', '/ai/explain'],
];

describe('Documentación OpenAPI / Swagger', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(() => ctx.app.close());

  it('serves the Swagger UI and the JSON document', async () => {
    await ctx.http().get('/api/docs').expect(200).expect('Content-Type', /html/);
    const res = await ctx.http().get('/api/docs-json').expect(200);
    expect(res.body.info.title).toBe('BARTENDER LAB API');
  });

  it.each(REQUIRED_ENDPOINTS)('documents %s %s', async (method, path) => {
    const res = await ctx.http().get('/api/docs-json').expect(200);
    expect(res.body.paths[`${API}${path}`]?.[method]).toBeDefined();
  });

  it('keeps the committed docs/api/openapi.json up to date (run npm run openapi:export)', async () => {
    const committed = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', '..', 'docs', 'api', 'openapi.json'), 'utf8'),
    );
    expect(await generateOpenApiDocument()).toEqual(committed);
  });
});
