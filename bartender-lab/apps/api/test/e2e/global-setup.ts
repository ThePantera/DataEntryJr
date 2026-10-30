import { execSync } from 'node:child_process';
import { join } from 'node:path';
import { loadTestEnv } from './test-env';

/**
 * Applies the committed migrations to the test database (non-destructive).
 * Each suite then empties the tables itself through resetDatabase().
 */
export default function globalSetup(): void {
  loadTestEnv();
  execSync('npx prisma migrate deploy', {
    cwd: join(__dirname, '..', '..'),
    env: process.env,
    stdio: 'pipe',
  });
}
