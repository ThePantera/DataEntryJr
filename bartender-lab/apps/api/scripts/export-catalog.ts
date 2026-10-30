/**
 * Writes the initial offline catalog bundled in the mobile app:
 * packages/client-core/data/catalog.json (committed; a unit test checks it is current).
 * Usage: npm run catalog:export -w @bartender-lab/api
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildCatalog } from '../prisma/catalog';

export const CATALOG_PATH = join(
  __dirname,
  '..',
  '..',
  '..',
  'packages',
  'client-core',
  'data',
  'catalog.json',
);

writeFileSync(CATALOG_PATH, `${JSON.stringify(buildCatalog(), null, 2)}\n`);
console.log(`Catalog written to ${CATALOG_PATH}`);
