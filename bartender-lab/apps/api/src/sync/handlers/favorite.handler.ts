import { toFavoriteDto } from '../../favorites/favorite.mapper';
import { decideVersionedWrite } from '../conflict-rules';
import type { SyncOperationDto } from '../dto/sync.dto';
import { FavoritePayloadDto } from './payloads';
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

/**
 * Favorites are a set keyed by (user, recipe). Adding is never a conflict: a favorite created
 * on another device for the same recipe is MERGED into the existing record.
 */
export class FavoriteSyncHandler implements SyncHandler {
  async upsert(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const parsed = parsePayload(FavoritePayloadDto, op.payload);
    if (!parsed.ok) return parsed.outcome;
    const { recipeId } = parsed.value;

    const byId = await tx.favorite.findUnique({ where: { id: op.entityId } });
    if (byId && byId.userId !== userId) return rejected('NOT_FOUND');
    if (byId) {
      if (byId.recipeId !== recipeId)
        return rejected('INVALID_PAYLOAD', ['recipeId cannot change']);
      if (!byId.deletedAt) return applied(toFavoriteDto(byId));
      return applied(toFavoriteDto(await this.revive(tx, byId.id)));
    }

    const byKey = await tx.favorite.findUnique({
      where: { userId_recipeId: { userId, recipeId } },
    });
    if (byKey && !byKey.deletedAt) return merged(byKey.id, toFavoriteDto(byKey));

    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      select: { verificationStatus: true },
    });
    if (recipe?.verificationStatus !== 'PUBLISHED') return rejected('RECIPE_NOT_AVAILABLE');

    if (byKey) return merged(byKey.id, toFavoriteDto(await this.revive(tx, byKey.id)));
    return applied(
      toFavoriteDto(await tx.favorite.create({ data: { id: op.entityId, userId, recipeId } })),
    );
  }

  async remove(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome> {
    const existing = await tx.favorite.findUnique({ where: { id: op.entityId } });
    if (existing && existing.userId !== userId) return rejected('NOT_FOUND');

    const decision = decideVersionedWrite(
      'DELETE',
      op.baseVersion ?? null,
      existing && recordState(existing),
    );
    if (decision.kind === 'NOOP') return applied(existing && toFavoriteDto(existing));
    if (decision.kind === 'CONFLICT') return conflict(decision.reason, toFavoriteDto(existing!));

    const { count } = await tx.favorite.updateMany({
      where: { id: op.entityId, version: existing!.version },
      data: { deletedAt: new Date(), version: { increment: 1 } },
    });
    const row = await tx.favorite.findUniqueOrThrow({ where: { id: op.entityId } });
    return count === 1
      ? applied(toFavoriteDto(row))
      : conflict('STALE_VERSION', toFavoriteDto(row));
  }

  private revive(tx: Tx, id: string) {
    return tx.favorite.update({
      where: { id },
      data: { deletedAt: null, version: { increment: 1 } },
    });
  }
}
