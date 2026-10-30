import { validateEnv } from '../../src/config/env.validation';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  JWT_ACCESS_SECRET: 'x'.repeat(32),
};

describe('validateEnv', () => {
  it('applies safe defaults for optional settings', () => {
    const config = validateEnv(valid);
    expect(config).toMatchObject({
      nodeEnv: 'development',
      port: 3000,
      jwtAccessTtlSeconds: 900,
      refreshTokenTtlDays: 30,
      throttleTtlSeconds: 60,
      throttleLimit: 120,
      authThrottleLimit: 10,
      corsOrigins: [],
      trustProxy: false,
      swaggerEnabled: true,
      passwordHashCost: 17,
    });
  });

  it('parses explicit values', () => {
    const config = validateEnv({
      ...valid,
      PORT: '8080',
      CORS_ORIGINS: 'https://a.example, https://b.example',
      TRUST_PROXY: '1',
      SWAGGER_ENABLED: '0',
    });
    expect(config.port).toBe(8080);
    expect(config.corsOrigins).toEqual(['https://a.example', 'https://b.example']);
    expect(config.trustProxy).toBe(true);
    expect(config.swaggerEnabled).toBe(false);
  });

  it('requires a database URL and a JWT secret', () => {
    expect(() => validateEnv({})).toThrow(/DATABASE_URL[\s\S]*JWT_ACCESS_SECRET/);
  });

  it('rejects a JWT secret shorter than 32 characters', () => {
    expect(() => validateEnv({ ...valid, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('never includes secret values in the error message', () => {
    const secret = 'super-secret-value';
    expect.assertions(2);
    try {
      validateEnv({ ...valid, JWT_ACCESS_SECRET: secret });
    } catch (error) {
      expect((error as Error).message).toContain('JWT_ACCESS_SECRET');
      expect((error as Error).message).not.toContain(secret);
    }
  });

  it('rejects the example placeholder secret in production', () => {
    expect(() =>
      validateEnv({
        ...valid,
        NODE_ENV: 'production',
        JWT_ACCESS_SECRET: 'change-me-to-a-long-random-secret-of-at-least-32-chars',
      }),
    ).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('rejects a weak password hashing cost in production', () => {
    expect(() =>
      validateEnv({ ...valid, NODE_ENV: 'production', PASSWORD_HASH_COST: '14' }),
    ).toThrow(/PASSWORD_HASH_COST/);
  });

  it('rejects non-numeric or non-positive numbers', () => {
    expect(() => validateEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => validateEnv({ ...valid, THROTTLE_LIMIT: '0' })).toThrow(/THROTTLE_LIMIT/);
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => validateEnv({ ...valid, NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
  });
});
