/**
 * Repair tool: recomputes download_manifest from the content tables.
 * Usage: npm run manifest:rebuild -w @bartender-lab/api
 */
import { PrismaClient } from '@prisma/client';
import { existsSync } from 'node:fs';
import { rebuildManifest } from '../src/manifest/manifest-store';

async function main(): Promise<void> {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const prisma = new PrismaClient();
  try {
    const { changed } = await rebuildManifest(prisma);
    console.log(`Manifest rebuilt: ${changed} entries changed.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
