import { toShoppingListDto } from '../../shopping-lists/shopping-list.mapper';
import { decideVersionedWrite } from '../conflict-rules';
import type { SyncOperationDto } from '../dto/sync.dto';
import { ShoppingListPayloadDto } from './payloads';
import {
  applied,
  conflict,
  parsePayload,
  recordState,
  rejected,
  type OpOutcome,
  type SyncHandler,
  type Tx,
} from './sync-handler';

export class ShoppingListSyncHandler implements SyncHandler {
  async upsert(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const parsed = parsePayload(ShoppingListPayloadDto, op.payload);
    if (!parsed.ok) return parsed.outcome;

    const existing = await tx.shoppingList.findUnique({ where: { id: op.entityId } });
    if (existing && existing.userId !== userId) return rejected('NOT_FOUND');
    if (!existing) {
      const created = await tx.shoppingList.create({
        data: { id: op.entityId, userId, name: parsed.value.name },
      });
      return applied(toShoppingListDto(created));
    }

    const decision = decideVersionedWrite('UPSERT', op.baseVersion ?? null, recordState(existing));
    if (decision.kind === 'CONFLICT') return conflict(decision.reason, toShoppingListDto(existing));
    return this.write(tx, existing.id, existing.version, { name: parsed.value.name });
  }

  /** Deleting a list also tombstones its items so other devices remove them too. */
  async remove(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const existing = await tx.shoppingList.findUnique({ where: { id: op.entityId } });
    if (existing && existing.userId !== userId) return rejected('NOT_FOUND');

    const decision = decideVersionedWrite(
      'DELETE',
      op.baseVersion ?? null,
      existing && recordState(existing),
    );
    if (decision.kind === 'NOOP') return applied(existing && toShoppingListDto(existing));
    if (decision.kind === 'CONFLICT')
      return conflict(decision.reason, toShoppingListDto(existing!));

    const deletedAt = new Date();
    const outcome = await this.write(tx, existing!.id, existing!.version, { deletedAt });
    if (outcome.status === 'APPLIED') {
      await tx.shoppingListItem.updateMany({
        where: { shoppingListId: existing!.id, deletedAt: null },
        data: { deletedAt, version: { increment: 1 } },
      });
    }
    return outcome;
  }

  private async write(tx: Tx, id: string, version: number, data: object): Promise<OpOutcome> {
    const { count } = await tx.shoppingList.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    const row = await tx.shoppingList.findUniqueOrThrow({ where: { id } });
    return count === 1
      ? applied(toShoppingListDto(row))
      : conflict('STALE_VERSION', toShoppingListDto(row));
  }
}
