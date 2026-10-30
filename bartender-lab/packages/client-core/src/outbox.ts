import { nowIso, type Db } from './db';

export type EntityType = 'FAVORITE' | 'INVENTORY' | 'SHOPPING_LIST' | 'SHOPPING_LIST_ITEM';
export type OutboxAction = 'UPSERT' | 'DELETE';

export interface OutboxOp {
  seq: number;
  opId: string;
  entityType: EntityType;
  action: OutboxAction;
  entityId: string;
  baseVersion: number | null;
  payload: Record<string, unknown> | null;
}

interface OutboxRow {
  seq: number;
  op_id: string;
  entity_type: EntityType;
  action: OutboxAction;
  entity_id: string;
  base_version: number | null;
  payload: string | null;
  in_flight: number;
}

const toOp = (row: OutboxRow): OutboxOp => ({
  seq: row.seq,
  opId: row.op_id,
  entityType: row.entity_type,
  action: row.action,
  entityId: row.entity_id,
  baseVersion: row.base_version,
  payload: row.payload ? (JSON.parse(row.payload) as Record<string, unknown>) : null,
});

/**
 * Queue of changes made on this device, waiting for POST /sync/push (spec: "cola de operaciones
 * pendientes"). Each op keeps its opId until the server answers, so a retry is idempotent.
 *
 * Coalescing (only with ops not yet sent): one pending op per entity.
 *  - UPSERT after UPSERT/DELETE → the pending op takes the newest full state, keeping its baseVersion.
 *  - DELETE after an unsent create → both disappear (the server never knew the record).
 *  - DELETE after UPSERT → the pending op becomes a DELETE with the same baseVersion.
 * Rebase: when the server answers an op for an entity, the ops queued after it for that entity are
 * rebased onto the new server version, because they were made on top of that change.
 */
export class Outbox {
  constructor(
    private readonly db: Db,
    private readonly newId: () => string,
  ) {}

  async enqueue(
    entityType: EntityType,
    action: OutboxAction,
    entityId: string,
    localVersion: number,
    payload: Record<string, unknown> | null,
  ): Promise<void> {
    const baseVersion = localVersion > 0 ? localVersion : null;
    const pending = await this.db.getFirstAsync<OutboxRow>(
      `SELECT * FROM outbox WHERE entity_type = ? AND entity_id = ? AND in_flight = 0
       ORDER BY seq DESC LIMIT 1`,
      entityType,
      entityId,
    );
    const json = payload ? JSON.stringify(payload) : null;

    if (pending && action === 'UPSERT') {
      await this.db.runAsync(
        "UPDATE outbox SET action = 'UPSERT', payload = ? WHERE seq = ?",
        json,
        pending.seq,
      );
      return;
    }
    if (pending && action === 'DELETE') {
      if (pending.action === 'DELETE') return;
      const inFlight = await this.db.getFirstAsync<{ n: number }>(
        'SELECT COUNT(*) AS n FROM outbox WHERE entity_type = ? AND entity_id = ? AND in_flight = 1',
        entityType,
        entityId,
      );
      if (pending.base_version === null && (inFlight?.n ?? 0) === 0) {
        await this.db.runAsync('DELETE FROM outbox WHERE seq = ?', pending.seq);
        return;
      }
      await this.db.runAsync(
        "UPDATE outbox SET action = 'DELETE', payload = NULL WHERE seq = ?",
        pending.seq,
      );
      return;
    }
    await this.db.runAsync(
      `INSERT INTO outbox (op_id, entity_type, action, entity_id, base_version, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      this.newId(),
      entityType,
      action,
      entityId,
      baseVersion,
      json,
      nowIso(),
    );
  }

  async pending(limit = 100): Promise<OutboxOp[]> {
    const rows = await this.db.getAllAsync<OutboxRow>(
      'SELECT * FROM outbox WHERE in_flight = 0 ORDER BY seq LIMIT ?',
      limit,
    );
    return rows.map(toOp);
  }

  async count(): Promise<number> {
    return (await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM outbox'))?.n ?? 0;
  }

  async markInFlight(seqs: number[]): Promise<void> {
    for (const seq of seqs)
      await this.db.runAsync('UPDATE outbox SET in_flight = 1 WHERE seq = ?', seq);
  }

  /** After a crash or a failed request, sent-but-unanswered ops go back to the queue (same opId). */
  async resetInFlight(): Promise<void> {
    await this.db.runAsync('UPDATE outbox SET in_flight = 0 WHERE in_flight = 1');
  }

  async remove(seq: number): Promise<void> {
    await this.db.runAsync('DELETE FROM outbox WHERE seq = ?', seq);
  }

  async hasPending(entityType: EntityType, entityId: string): Promise<boolean> {
    const row = await this.db.getFirstAsync<{ n: number }>(
      'SELECT COUNT(*) AS n FROM outbox WHERE entity_type = ? AND entity_id = ?',
      entityType,
      entityId,
    );
    return (row?.n ?? 0) > 0;
  }

  async rebase(entityType: EntityType, entityId: string, version: number): Promise<void> {
    await this.db.runAsync(
      'UPDATE outbox SET base_version = ? WHERE entity_type = ? AND entity_id = ? AND in_flight = 0',
      version,
      entityType,
      entityId,
    );
  }

  async dropForEntity(entityType: EntityType, entityId: string): Promise<void> {
    await this.db.runAsync(
      'DELETE FROM outbox WHERE entity_type = ? AND entity_id = ? AND in_flight = 0',
      entityType,
      entityId,
    );
  }

  async rekey(entityType: EntityType, fromId: string, toId: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE outbox SET entity_id = ? WHERE entity_type = ? AND entity_id = ? AND in_flight = 0',
      toId,
      entityType,
      fromId,
    );
  }

  /** Drops unsent item ops of a shopping list that is being deleted. */
  async dropItemsOfList(listId: string): Promise<void> {
    await this.db.runAsync(
      `DELETE FROM outbox WHERE entity_type = 'SHOPPING_LIST_ITEM' AND in_flight = 0
       AND json_extract(payload, '$.shoppingListId') = ?`,
      listId,
    );
  }
}
