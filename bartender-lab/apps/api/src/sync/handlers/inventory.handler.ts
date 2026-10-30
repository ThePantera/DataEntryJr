import { parseDateOnly } from '../../common/utils/dates';
import { INVENTORY_INCLUDE, toInventoryItemDto } from '../../inventory/inventory.mapper';
import { decideVersionedWrite } from '../conflict-rules';
import type { SyncOperationDto } from '../dto/sync.dto';
import { InventoryPayloadDto } from './payloads';
import {
  applied,
  conflict,
  merged,
  parsePayload,
  recordState,
  rejected,
  type OpOutcome,
  type SyncHandler,
  type Tx,
} from './sync-handler';

/** UPSERT carries the full record: omitted optional fields are stored as empty. */
function fullState(payload: InventoryPayloadDto) {
  return {
    quantity: payload.quantity ?? null,
    unit: payload.unit ?? null,
    expirationDate: payload.expirationDate ? parseDateOnly(payload.expirationDate) : null,
  };
}

export class InventorySyncHandler implements SyncHandler {
  async upsert(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const parsed = parsePayload(InventoryPayloadDto, op.payload);
    if (!parsed.ok) return parsed.outcome;
    const payload = parsed.value;

    const existing = await tx.inventoryItem.findUnique({
      where: { id: op.entityId },
      include: INVENTORY_INCLUDE,
    });
    if (existing && existing.userId !== userId) return rejected('NOT_FOUND');
    if (existing) {
      if (existing.ingredientId !== payload.ingredientId) {
        return rejected('INVALID_PAYLOAD', ['ingredientId cannot change']);
      }
      const decision = decideVersionedWrite(
        'UPSERT',
        op.baseVersion ?? null,
        recordState(existing),
      );
      if (decision.kind === 'CONFLICT')
        return conflict(decision.reason, toInventoryItemDto(existing));
      return this.write(tx, op.entityId, existing.version, fullState(payload));
    }

    if (
      !(await tx.ingredient.findUnique({
        where: { id: payload.ingredientId },
        select: { id: true },
      }))
    ) {
      return rejected('UNKNOWN_INGREDIENT');
    }
    const byKey = await tx.inventoryItem.findUnique({
      where: { userId_ingredientId: { userId, ingredientId: payload.ingredientId } },
      include: INVENTORY_INCLUDE,
    });
    if (byKey && !byKey.deletedAt)
      return conflict('DUPLICATE', toInventoryItemDto(byKey), byKey.id);
    if (byKey) {
      const revived = await tx.inventoryItem.update({
        where: { id: byKey.id },
        data: { ...fullState(payload), deletedAt: null, version: { increment: 1 } },
        include: INVENTORY_INCLUDE,
      });
      return merged(byKey.id, toInventoryItemDto(revived));
    }
    const created = await tx.inventoryItem.create({
      data: { id: op.entityId, userId, ingredientId: payload.ingredientId, ...fullState(payload) },
      include: INVENTORY_INCLUDE,
    });
    return applied(toInventoryItemDto(created));
  }

  async remove(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const existing = await tx.inventoryItem.findUnique({
      where: { id: op.entityId },
      include: INVENTORY_INCLUDE,
    });
    if (existing && existing.userId !== userId) return rejected('NOT_FOUND');

    const decision = decideVersionedWrite(
      'DELETE',
      op.baseVersion ?? null,
      existing && recordState(existing),
    );
    if (decision.kind === 'NOOP') return applied(existing && toInventoryItemDto(existing));
    if (decision.kind === 'CONFLICT')
      return conflict(decision.reason, toInventoryItemDto(existing!));
    return this.write(tx, op.entityId, existing!.version, { deletedAt: new Date() });
  }

  /** Conditional write: if another transaction bumped the version first, report a conflict. */
  private async write(tx: Tx, id: string, version: number, data: object): Promise<OpOutcome> {
    const { count } = await tx.inventoryItem.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    const row = await tx.inventoryItem.findUniqueOrThrow({
      where: { id },
      include: INVENTORY_INCLUDE,
    });
    return count === 1
      ? applied(toInventoryItemDto(row))
      : conflict('STALE_VERSION', toInventoryItemDto(row));
  }
}
