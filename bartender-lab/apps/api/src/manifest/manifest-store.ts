import type { Prisma, PrismaClient, ResourceType } from '@prisma/client';

type Db = Prisma.TransactionClient | PrismaClient;

interface DesiredEntry {
  resourceType: ResourceType;
  resourceId: string;
  version: number;
  deleted: boolean;
}

/** Upserts the manifest entry of one public resource. */
export async function recordManifestEntry(
  db: Db,
  resourceType: ResourceType,
  resourceId: string,
  version: number,
  deleted = false,
): Promise<void> {
  const updatedAt = new Date();
  await db.downloadManifest.upsert({
    where: { resourceType_resourceId: { resourceType, resourceId } },
    create: { resourceType, resourceId, version, deleted, updatedAt },
    update: { version, deleted, updatedAt },
  });
}

/**
 * Recomputes the manifest from the content tables (after seeding or as a repair tool).
 * Only rows whose version or deleted flag changed are touched, so clients are not told
 * that unchanged resources are outdated.
 */
export async function rebuildManifest(prisma: PrismaClient): Promise<{ changed: number }> {
  const [recipes, ingredients, techniques, glassware, equipment, categories, existing] =
    await Promise.all([
      prisma.recipe.findMany({ select: { id: true, version: true, verificationStatus: true } }),
      prisma.ingredient.findMany({ select: { id: true, version: true } }),
      prisma.technique.findMany({ select: { id: true, version: true } }),
      prisma.glassware.findMany({ select: { id: true, version: true } }),
      prisma.equipment.findMany({ select: { id: true, version: true } }),
      prisma.category.findMany({ select: { id: true, version: true } }),
      prisma.downloadManifest.findMany(),
    ]);

  const key = (type: ResourceType, id: string) => `${type}:${id}`;
  const current = new Map(existing.map((e) => [key(e.resourceType, e.resourceId), e]));
  const desired = new Map<string, DesiredEntry>();
  const add = (resourceType: ResourceType, rows: Array<{ id: string; version: number }>) => {
    for (const row of rows) {
      desired.set(key(resourceType, row.id), {
        resourceType,
        resourceId: row.id,
        version: row.version,
        deleted: false,
      });
    }
  };
  add('INGREDIENT', ingredients);
  add('TECHNIQUE', techniques);
  add('GLASSWARE', glassware);
  add('EQUIPMENT', equipment);
  add('CATEGORY', categories);
  for (const recipe of recipes) {
    const k = key('RECIPE', recipe.id);
    if (recipe.verificationStatus === 'PUBLISHED') add('RECIPE', [recipe]);
    else if (current.has(k)) {
      desired.set(k, {
        resourceType: 'RECIPE',
        resourceId: recipe.id,
        version: recipe.version,
        deleted: true,
      });
    }
  }
  // Entries whose resource no longer exists become tombstones.
  for (const [k, entry] of current) {
    if (!desired.has(k)) desired.set(k, { ...entry, deleted: true });
  }

  let changed = 0;
  for (const [k, entry] of desired) {
    const before = current.get(k);
    if (before && before.version === entry.version && before.deleted === entry.deleted) continue;
    await recordManifestEntry(
      prisma,
      entry.resourceType,
      entry.resourceId,
      entry.version,
      entry.deleted,
    );
    changed += 1;
  }
  return { changed };
}
