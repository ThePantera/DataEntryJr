import { API, bearer, createTestApp, createUser, resetDatabase, type TestContext } from './helpers';

describe('Auth (registro, inicio de sesión, tokens)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
    await resetDatabase(ctx.prisma);
  });

  afterAll(() => ctx.app.close());

  const register = (body: object) => ctx.http().post(`${API}/auth/register`).send(body);
  const login = (body: object) => ctx.http().post(`${API}/auth/login`).send(body);

  it('registers a user and returns tokens without exposing the password hash', async () => {
    const res = await register({
      email: '  Ana@Example.com ',
      password: 'una-contraseña-larga',
      displayName: 'Ana',
    }).expect(201);

    expect(res.body.user).toEqual({
      id: expect.any(String),
      email: 'ana@example.com',
      displayName: 'Ana',
      role: 'USER',
      createdAt: expect.any(String),
    });
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('stores only a password hash, never the plain password', async () => {
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { email: 'ana@example.com' } });
    expect(user.passwordHash).not.toContain('una-contraseña-larga');
    expect(user.passwordHash.startsWith('scrypt$')).toBe(true);
  });

  it('rejects a duplicate email regardless of case', async () => {
    await register({
      email: 'ANA@example.com',
      password: 'otra-contraseña-larga',
      displayName: 'X',
    }).expect(409);
  });

  it('validates the registration payload', async () => {
    const res = await register({
      email: 'not-an-email',
      password: 'short',
      displayName: '',
    }).expect(400);
    expect(res.body.message).toEqual(
      expect.arrayContaining([
        expect.stringContaining('email'),
        expect.stringContaining('password'),
      ]),
    );
  });

  it('rejects unknown fields such as a self-assigned role', async () => {
    await register({
      email: 'mallory@example.com',
      password: 'una-contraseña-larga',
      displayName: 'Mallory',
      role: 'ADMIN',
    }).expect(400);
  });

  it('logs in with valid credentials', async () => {
    const res = await login({ email: 'ana@example.com', password: 'una-contraseña-larga' }).expect(
      200,
    );
    expect(res.body.user.email).toBe('ana@example.com');
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrong = await login({ email: 'ana@example.com', password: 'incorrecta' }).expect(401);
    const unknown = await login({ email: 'nadie@example.com', password: 'incorrecta' }).expect(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it('protects private routes and accepts a valid access token', async () => {
    await ctx.http().get(`${API}/users/me`).expect(401);
    await ctx.http().get(`${API}/users/me`).set('Authorization', 'Bearer garbage').expect(401);

    const user = await createUser(ctx);
    const res = await ctx.http().get(`${API}/users/me`).set(bearer(user)).expect(200);
    expect(res.body.id).toBe(user.id);
  });

  it('rotates refresh tokens: the old one stops working', async () => {
    const user = await createUser(ctx);
    const first = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(200);
    expect(first.body.refreshToken).not.toBe(user.refreshToken);

    await ctx
      .http()
      .get(`${API}/users/me`)
      .set('Authorization', `Bearer ${first.body.accessToken}`)
      .expect(200);
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('revokes the whole session when a used refresh token is replayed', async () => {
    const user = await createUser(ctx);
    const rotated = await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(200);

    // An attacker replays the stolen, already used token...
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
    // ...so the legitimate newer token is revoked too.
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: rotated.body.refreshToken })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const user = await createUser(ctx);
    await ctx
      .http()
      .post(`${API}/auth/logout`)
      .send({ refreshToken: user.refreshToken })
      .expect(204);
    await ctx
      .http()
      .post(`${API}/auth/refresh`)
      .send({ refreshToken: user.refreshToken })
      .expect(401);
  });

  it('stores refresh tokens hashed', async () => {
    const user = await createUser(ctx);
    const stored = await ctx.prisma.refreshToken.findMany({ where: { userId: user.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].tokenHash).not.toBe(user.refreshToken);
  });
});

describe('Auth rate limiting', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp({ AUTH_THROTTLE_LIMIT: '3' });
  });

  afterAll(() => ctx.app.close());

  it('blocks repeated login attempts with 429', async () => {
    const attempt = () =>
      ctx.http().post(`${API}/auth/login`).send({ email: 'brute@example.com', password: 'guess' });
    for (let i = 0; i < 3; i += 1) await attempt().expect(401);
    await attempt().expect(429);
  });

  it('does not apply the auth limit to other routes', async () => {
    for (let i = 0; i < 5; i += 1) await ctx.http().get(`${API}/health`).expect(200);
  });
});
