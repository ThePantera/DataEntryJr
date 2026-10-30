import { JwtService } from '@nestjs/jwt';
import { seedCatalog, type Catalog } from './fixtures';
import {
  API,
  bearer,
  createTestApp,
  createUser,
  resetDatabase,
  type TestContext,
  type TestUser,
} from './helpers';

describe('Usuarios, roles y control de permisos', () => {
  let ctx: TestContext;
  let catalog: Catalog;
  let admin: TestUser;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
    catalog = await seedCatalog(ctx);
    admin = await createUser(ctx, 'ADMIN');
  });

  afterAll(() => ctx.app.close());

  const setRole = (actor: TestUser, target: TestUser, role: string) =>
    ctx.http().patch(`${API}/users/${target.id}/role`).set(bearer(actor)).send({ role });

  const createIngredient = (actor: TestUser, name: string) =>
    ctx
      .http()
      .post(`${API}/ingredients`)
      .set(bearer(actor))
      .send({ name, categoryId: catalog.categories.modifiers.id });

  it('lets users read and update their own profile', async () => {
    const user = await createUser(ctx);
    const res = await ctx
      .http()
      .patch(`${API}/users/me`)
      .set(bearer(user))
      .send({ displayName: '  Ana Bartender  ' })
      .expect(200);
    expect(res.body).toMatchObject({ id: user.id, displayName: 'Ana Bartender', role: 'USER' });
    expect(res.body).not.toHaveProperty('passwordHash');
    await ctx
      .http()
      .patch(`${API}/users/me`)
      .set(bearer(user))
      .send({ displayName: '' })
      .expect(400);
  });

  it('only lets admins change roles', async () => {
    const user = await createUser(ctx);
    const editor = await createUser(ctx, 'EDITOR');
    await setRole(user, user, 'ADMIN').expect(403);
    await setRole(editor, user, 'EDITOR').expect(403);
    await setRole(admin, user, 'EDITOR').expect(200);
  });

  it('applies a demotion immediately, even with a token issued before it', async () => {
    const editor = await createUser(ctx, 'EDITOR');
    await createIngredient(editor, 'Licor de prueba A').expect(201);
    await setRole(admin, editor, 'USER').expect(200);
    await createIngredient(editor, 'Licor de prueba B').expect(403);
  });

  it('applies a promotion immediately', async () => {
    const user = await createUser(ctx);
    await createIngredient(user, 'Licor de prueba C').expect(403);
    await setRole(admin, user, 'EDITOR').expect(200);
    await createIngredient(user, 'Licor de prueba C').expect(201);
  });

  it('never leaves the system without an admin', async () => {
    await ctx.prisma.user.updateMany({
      where: { role: 'ADMIN', NOT: { id: admin.id } },
      data: { role: 'USER' },
    });
    await setRole(admin, admin, 'USER').expect(409);

    const second = await createUser(ctx, 'ADMIN');
    await setRole(admin, second, 'USER').expect(200);
    await setRole(admin, second, 'ADMIN').expect(200);
    await setRole(second, admin, 'USER').expect(200);
  });

  it('rejects tokens of deleted users', async () => {
    const user = await createUser(ctx);
    await ctx.prisma.user.delete({ where: { id: user.id } });
    await ctx.http().get(`${API}/users/me`).set(bearer(user)).expect(401);
  });

  it('rejects tokens signed with another secret, even if they claim to be admin', async () => {
    const forged = await new JwtService({ secret: 'x'.repeat(40) }).signAsync(
      { sub: admin.id, role: 'ADMIN' },
      { issuer: 'bartender-lab-api', audience: 'bartender-lab-api' },
    );
    await ctx
      .http()
      .patch(`${API}/users/${admin.id}/role`)
      .set('Authorization', `Bearer ${forged}`)
      .send({ role: 'ADMIN' })
      .expect(401);
  });

  it('ignores an invalid token on public content so offline clients with stale tokens still work', async () => {
    await ctx
      .http()
      .get(`${API}/recipes`)
      .set('Authorization', 'Bearer stale.or.invalid')
      .expect(200);
  });
});
