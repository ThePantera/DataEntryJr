import { ITEM_INCLUDE, toShoppingListItemDto } from '../../shopping-lists/shopping-list.mapper';
import { decideVersionedWrite } from '../conflict-rules';
import type { SyncOperationDto } from '../dto/sync.dto';
import { ShoppingListItemPayloadDto } from './payloads';
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

const WITH_OWNER = { ...ITEM_INCLUDE, shoppingList: { select: { userId: true } } } as const;

function fullState(payload: ShoppingListItemPayloadDto) {
  return {
    quantity: payload.quantity ?? null,
    unit: payload.unit ?? null,
    completed: payload.completed ?? false,
  };
}

export class ShoppingListItemSyncHandler implements SyncHandler {
  async upsert(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const parsed = parsePayload(ShoppingListItemPayloadDto, op.payload);
    if (!parsed.ok) return parsed.outcome;
    const payload = parsed.value;

    const existing = await tx.shoppingListItem.findUnique({
      where: { id: op.entityId },
      include: WITH_OWNER,
    });
    if (existing && existing.shoppingList.userId !== userId) return rejected('NOT_FOUND');
    if (existing) {
      if (
        existing.shoppingListId !== payload.shoppingListId ||
        existing.ingredientId !== payload.ingredientId
      ) {
        return rejected('INVALID_PAYLOAD', ['shoppingListId and ingredientId cannot change']);
      }
      const decision = decideVersionedWrite(
        'UPSERT',
        op.baseVersion ?? null,
        recordState(existing),
      );
      if (decision.kind === 'CONFLICT')
        return conflict(decision.reason, toShoppingListItemDto(existing));
      return this.write(tx, existing.id, existing.version, fullState(payload));
    }

    const list = await tx.shoppingList.findUnique({ where: { id: payload.shoppingListId } });
    if (!list || list.userId !== userId) return rejected('NOT_FOUND');
    if (list.deletedAt) return rejected('PARENT_DELETED');
    if (
      !(await tx.ingredient.findUnique({
        where: { id: payload.ingredientId },
        select: { id: true },
      }))
    ) {
      return rejected('UNKNOWN_INGREDIENT');
    }

    const byKey = await tx.shoppingListItem.findUnique({
      where: {
        shoppingListId_ingredientId: {
          shoppingListId: list.id,
          ingredientId: payload.ingredientId,
        },
      },
      include: ITEM_INCLUDE,
    });
    if (byKey && !byKey.deletedAt)
      return conflict('DUPLICATE', toShoppingListItemDto(byKey), byKey.id);
    if (byKey) {
      const revived = await tx.shoppingListItem.update({
        where: { id: byKey.id },
        data: { ...fullState(payload), deletedAt: null, version: { increment: 1 } },
        include: ITEM_INCLUDE,
      });
      return merged(byKey.id, toShoppingListItemDto(revived));
    }
    const created = await tx.shoppingListItem.create({
      data: {
        id: op.entityId,
        shoppingListId: list.id,
        ingredientId: payload.ingredientId,
        ...fullState(payload),
      },
      include: ITEM_INCLUDE,
    });
    return applied(toShoppingListItemDto(created));
  }

  async remove(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const existing = await tx.shoppingListItem.findUnique({
      where: { id: op.entityId },
      include: WITH_OWNER,
    });
    if (existing && existing.shoppingList.userId !== userId) return rejected('NOT_FOUND');

    const decision = decideVersionedWrite(
      'DELETE',
      op.baseVersion ?? null,
      existing && recordState(existing),
    );
    if (decision.kind === 'NOOP') return applied(existing && toShoppingListItemDto(existing));
    if (decision.kind === 'CONFLICT')
      return conflict(decision.reason, toShoppingListItemDto(existing!));
    return this.write(tx, existing!.id, existing!.version, { deletedAt: new Date() });
  }

  private async write(tx: Tx, id: string, version: number, data: object): Promise<OpOutcome> {
    const { count } = await tx.shoppingListItem.updateMany({
      where: { id, version },
      data: { ...data, version: { increment: 1 } },
    });
    const row = await tx.shoppingListItem.findUniqueOrThrow({
      where: { id },
      include: ITEM_INCLUDE,
    });
    return count === 1
      ? applied(toShoppingListItemDto(row))
      : conflict('STALE_VERSION', toShoppingListItemDto(row));
  }
}
