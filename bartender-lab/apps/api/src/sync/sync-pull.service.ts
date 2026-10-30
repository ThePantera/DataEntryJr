import { Injectable } from '@nestjs/common';
import type { ResourceType } from '@prisma/client';
import { toFavoriteDto } from '../favorites/favorite.mapper';
import { INVENTORY_INCLUDE, toInventoryItemDto } from '../inventory/inventory.mapper';
import { PrismaService } from '../prisma/prisma.service';
import {
  ITEM_INCLUDE,
  toShoppingListDto,
  toShoppingListItemDto,
} from '../shopping-lists/shopping-list.mapper';
import type {
  ChangesResponseDto,
  ManifestEntryDto,
  ManifestResponseDto,
  UserChangesDto,
} from './dto/sync.dto';

/**
 * A row written by a transaction that started before a read but committed after it carries an
 * updatedAt slightly older than the read. Moving the cursor back by this window makes the next
 * pull include such rows; clients apply changes idempotently (by id + version), so re-delivery is
 * harmless while a missed change would not be.
 */
export const CURSOR_SAFETY_WINDOW_MS = 5_000;

const MANIFEST_SELECT = {
  resourceType: true,
  resourceId: true,
  version: true,
  deleted: true,
  updatedAt: true,
} as const;

@Injectable()
export class SyncPullService {
  constructor(private readonly prisma: PrismaService) {}

  async manifest(types?: ResourceType[]): Promise<ManifestResponseDto> {
    const entries = await this.prisma.downloadManifest.findMany({
      where: { resourceType: types ? { in: types } : undefined, deleted: false },
      select: MANIFEST_SELECT,
      orderBy: [{ resourceType: 'asc' }, { resourceId: 'asc' }],
    });
    return { entries, serverTime: new Date() };
  }

  async changes(since: Date | undefined, userId?: string): Promise<ChangesResponseDto> {
    const startedAt = Date.now();
    const updatedAt = since ? { gt: since } : undefined;

    const content: ManifestEntryDto[] = await this.prisma.downloadManifest.findMany({
      where: { updatedAt },
      select: MANIFEST_SELECT,
      orderBy: [{ updatedAt: 'asc' }, { resourceId: 'asc' }],
    });
    const user = userId ? await this.userChanges(userId, updatedAt) : null;

    const next = Math.max(since?.getTime() ?? 0, startedAt - CURSOR_SAFETY_WINDOW_MS);
    return {
      content,
      user,
      nextSince: new Date(next).toISOString(),
      serverTime: new Date(startedAt),
    };
  }

  private async userChanges(
    userId: string,
    updatedAt: { gt: Date } | undefined,
  ): Promise<UserChangesDto> {
    const order = [{ updatedAt: 'asc' as const }, { id: 'asc' as const }];
    const [favorites, inventory, shoppingLists, shoppingListItems] = await Promise.all([
      this.prisma.favorite.findMany({ where: { userId, updatedAt }, orderBy: order }),
      this.prisma.inventoryItem.findMany({
        where: { userId, updatedAt },
        include: INVENTORY_INCLUDE,
        orderBy: order,
      }),
      this.prisma.shoppingList.findMany({ where: { userId, updatedAt }, orderBy: order }),
      this.prisma.shoppingListItem.findMany({
        where: { shoppingList: { userId }, updatedAt },
        include: ITEM_INCLUDE,
        orderBy: order,
      }),
    ]);
    return {
      favorites: favorites.map(toFavoriteDto),
      inventory: inventory.map(toInventoryItemDto),
      shoppingLists: shoppingLists.map(toShoppingListDto),
      shoppingListItems: shoppingListItems.map(toShoppingListItemDto),
    };
  }
}
