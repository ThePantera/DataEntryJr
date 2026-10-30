/** End-to-end tests against a real PostgreSQL database (DATABASE_URL from .env.test). */
/** @type {import('jest').Config} */
module.exports = {
  rootDir: '..',
  testEnvironment: 'node',
  roots: ['<rootDir>/test/e2e'],
  testRegex: '\\.e2e-spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  setupFiles: ['<rootDir>/test/e2e/setup-env.ts'],
  globalSetup: '<rootDir>/test/e2e/global-setup.ts',
  testTimeout: 30000,
};
