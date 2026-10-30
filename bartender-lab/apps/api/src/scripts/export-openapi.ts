/**
 * Writes the OpenAPI contract to docs/api/openapi.json (committed; an e2e test checks it is current).
 * Usage: npm run openapi:export -w @bartender-lab/api
 * Runs from the compiled output because Nest's dependency injection needs decorator metadata,
 * which esbuild-based runners such as tsx do not emit.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { generateOpenApiDocument } from '../openapi';

const OPENAPI_PATH = join(__dirname, '..', '..', '..', '..', 'docs', 'api', 'openapi.json');

async function main(): Promise<void> {
  // Placeholders only: building the document needs no database connection or real secret.
  process.env.DATABASE_URL ??= 'postgresql://placeholder@localhost:5432/placeholder';
  process.env.JWT_ACCESS_SECRET ??= 'placeholder-secret-used-only-to-build-the-openapi-document';

  const document = await generateOpenApiDocument();
  mkdirSync(dirname(OPENAPI_PATH), { recursive: true });
  writeFileSync(OPENAPI_PATH, `${JSON.stringify(document, null, 2)}\n`);
  console.log(`OpenAPI written to ${OPENAPI_PATH}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
