import { Injectable } from '@nestjs/common';
import { Prisma, type SyncEntityType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type {
  SyncOperationDto,
  SyncOperationResultDto,
  SyncPushDto,
  SyncPushResponseDto,
} from './dto/sync.dto';
import { FavoriteSyncHandler } from './handlers/favorite.handler';
import { InventorySyncHandler } from './handlers/inventory.handler';
import { ShoppingListItemSyncHandler } from './handlers/shopping-list-item.handler';
import { ShoppingListSyncHandler } from './handlers/shopping-list.handler';
import type { SyncHandler } from './handlers/sync-handler';

/**
 * Applies the client's queue of pending operations, in order, one transaction per operation.
 *
 * Idempotency: each operation is claimed in sync_operations (unique per user + opId) at the start
 * of its transaction and its result stored at the end. A retried operation — after a lost response
 * or concurrently — returns the stored result with replayed = true and is never applied twice.
 */
@Injectable()
export class SyncPushService {
  private readonly handlers: Record<SyncEntityType, SyncHandler> = {
    FAVORITE: new FavoriteSyncHandler(),
    INVENTORY: new InventorySyncHandler(),
    SHOPPING_LIST: new ShoppingListSyncHandler(),
    SHOPPING_LIST_ITEM: new ShoppingListItemSyncHandler(),
  };

  constructor(private readonly prisma: PrismaService) {}

  async push(userId: string, dto: SyncPushDto): Promise<SyncPushResponseDto> {
    const results: SyncOperationResultDto[] = [];
    for (const op of dto.operations) results.push(await this.process(userId, op));
    return { results, serverTime: new Date() };
  }

  private async process(userId: string, op: SyncOperationDto): Promise<SyncOperationResultDto> {
    const stored = await this.findStored(userId, op.opId);
    if (stored) return stored;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const key = { userId_opId: { userId, opId: op.opId } };
        await tx.syncOperation.create({
          data: {
            userId,
            opId: op.opId,
            entityType: op.entityType,
            entityId: op.entityId,
            action: op.action,
            status: 'APPLIED',
            result: {},
          },
        });

        const handler = this.handlers[op.entityType];
        const outcome =
          op.action === 'UPSERT'
            ? await handler.upsert(tx, userId, op)
            : await handler.remove(tx, userId, op);
        const result: SyncOperationResultDto = {
          opId: op.opId,
          entityType: op.entityType,
          entityId: op.entityId,
          ...outcome,
          replayed: false,
        };

        await tx.syncOperation.update({
          where: key,
          data: {
            status: outcome.status,
            result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
          },
        });
        return result;
      });
    } catch (error) {
      // Lost the race against a concurrent request carrying the same operation.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const winner = await this.findStored(userId, op.opId);
        if (winner) return winner;
      }
      throw error;
    }
  }

  private async findStored(userId: string, opId: string): Promise<SyncOperationResultDto | null> {
    const row = await this.prisma.syncOperation.findUnique({
      where: { userId_opId: { userId, opId } },
    });
    return row ? { ...(row.result as unknown as SyncOperationResultDto), replayed: true } : null;
  }
}
