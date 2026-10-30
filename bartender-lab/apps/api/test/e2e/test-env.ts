import { existsSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULTS: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://bartender:bartender@localhost:5432/bartender_lab_test?schema=public',
  JWT_ACCESS_SECRET: 'test-secret-that-is-long-enough-for-hs256-signing',
  PASSWORD_HASH_COST: '12',
  THROTTLE_LIMIT: '100000',
  AUTH_THROTTLE_LIMIT: '100000',
  SWAGGER_ENABLED: '1',
};

/**
 * Precedence: real environment variables > apps/api/.env.test > defaults.
 * Refuses to continue unless the database name ends in "_test", because the suite wipes it.
 */
export function loadTestEnv(): void {
  const envFile = join(__dirname, '..', '..', '.env.test');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  for (const [key, value] of Object.entries(DEFAULTS)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }
  const databaseName = new URL(process.env.DATABASE_URL as string).pathname.slice(1);
  if (!databaseName.endsWith('_test')) {
    throw new Error(
      `E2E tests wipe the database; refusing to run against "${databaseName}" (must end in _test)`,
    );
  }
}
