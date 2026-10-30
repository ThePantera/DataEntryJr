/**
 * Explicit conflict rules for versioned user data pushed from offline clients
 * (inventory, shopping lists and their items; favorites reuse the DELETE rule).
 *
 * Every record carries an integer version that the server increments on each change.
 * The client sends the version it last saw (baseVersion):
 *  - UPSERT of an unknown id                    → CREATE
 *  - UPSERT with baseVersion = server version   → UPDATE
 *  - UPSERT with any other baseVersion          → CONFLICT (server wins; client receives server copy)
 *  - UPSERT of a record deleted on the server   → CONFLICT (deletion wins)
 *  - DELETE of an unknown or deleted record     → NOOP (idempotent)
 *  - DELETE with baseVersion = server version   → DELETE (soft delete, tombstone kept)
 *  - DELETE with any other baseVersion          → CONFLICT (the newer edit wins)
 */

export type SyncWriteAction = 'UPSERT' | 'DELETE';

export interface ServerRecordState {
  version: number;
  deleted: boolean;
}

export type WriteDecision =
  | { kind: 'CREATE' | 'UPDATE' | 'DELETE' | 'NOOP' }
  | { kind: 'CONFLICT'; reason: 'STALE_VERSION' | 'DELETED_ON_SERVER' };

export function decideVersionedWrite(
  action: SyncWriteAction,
  baseVersion: number | null,
  existing: ServerRecordState | null,
): WriteDecision {
  if (action === 'UPSERT') {
    if (!existing) return { kind: 'CREATE' };
    if (existing.deleted) return { kind: 'CONFLICT', reason: 'DELETED_ON_SERVER' };
    return baseVersion === existing.version
      ? { kind: 'UPDATE' }
      : { kind: 'CONFLICT', reason: 'STALE_VERSION' };
  }

  if (!existing || existing.deleted) return { kind: 'NOOP' };
  return baseVersion === existing.version
    ? { kind: 'DELETE' }
    : { kind: 'CONFLICT', reason: 'STALE_VERSION' };
}
