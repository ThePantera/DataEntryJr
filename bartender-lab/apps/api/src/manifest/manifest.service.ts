import { Injectable } from '@nestjs/common';
import type { Prisma, ResourceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rebuildManifest, recordManifestEntry } from './manifest-store';

type Db = Prisma.TransactionClient | PrismaService;

/**
 * Maintains download_manifest: the published version of every public resource.
 * Writers call record() inside the same transaction as the content change, so the manifest
 * can never announce a version that does not exist.
 */
@Injectable()
export class ManifestService {
  constructor(private readonly prisma: PrismaService) {}

  record(db: Db, resourceType: ResourceType, resourceId: string, version: number): Promise<void> {
    return recordManifestEntry(db, resourceType, resourceId, version);
  }

  /** Marks a resource as withdrawn, but only if clients could have downloaded it. */
  async withdraw(
    db: Db,
    resourceType: ResourceType,
    resourceId: string,
    version: number,
  ): Promise<void> {
    const existing = await db.downloadManifest.findUnique({
      where: { resourceType_resourceId: { resourceType, resourceId } },
    });
    if (existing && !existing.deleted) {
      await recordManifestEntry(db, resourceType, resourceId, version, true);
    }
  }

  rebuild(): Promise<{ changed: number }> {
    return rebuildManifest(this.prisma);
  }
}
