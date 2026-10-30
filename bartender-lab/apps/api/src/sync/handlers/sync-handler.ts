import type { Prisma, SyncStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validateSync, type ValidationError } from 'class-validator';
import type { SyncOperationDto, SyncReason } from '../dto/sync.dto';

export type Tx = Prisma.TransactionClient;

export interface OpOutcome {
  status: SyncStatus;
  reason?: SyncReason;
  details?: string[];
  canonicalId?: string;
  entity: object | null;
}

/** One handler per entity type. Handlers run inside the operation's transaction. */
export interface SyncHandler {
  upsert(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome>;
  remove(tx: Tx, userId: string, op: SyncOperationDto): Promise<OpOutcome>;
}

export const applied = (entity: object | null): OpOutcome => ({ status: 'APPLIED', entity });
export const merged = (canonicalId: string, entity: object): OpOutcome => ({
  status: 'MERGED',
  canonicalId,
  entity,
});
export const conflict = (reason: SyncReason, entity: object, canonicalId?: string): OpOutcome => ({
  status: 'CONFLICT',
  reason,
  entity,
  ...(canonicalId ? { canonicalId } : {}),
});
export const rejected = (reason: SyncReason, details?: string[]): OpOutcome => ({
  status: 'REJECTED',
  reason,
  entity: null,
  ...(details ? { details } : {}),
});

function messages(errors: ValidationError[], prefix = ''): string[] {
  return errors.flatMap((e) => [
    ...Object.values(e.constraints ?? {}).map((m) => `${prefix}${m}`),
    ...messages(e.children ?? [], `${prefix}${e.property}.`),
  ]);
}

/** Validates an operation payload with the same class-validator rules as the REST endpoints. */
export function parsePayload<T extends object>(
  cls: new () => T,
  payload: unknown,
): { ok: true; value: T } | { ok: false; outcome: OpOutcome } {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, outcome: rejected('INVALID_PAYLOAD', ['payload is required for UPSERT']) };
  }
  const value = plainToInstance(cls, payload);
  const errors = validateSync(value, { whitelist: true, forbidNonWhitelisted: true });
  if (errors.length > 0)
    return { ok: false, outcome: rejected('INVALID_PAYLOAD', messages(errors)) };
  return { ok: true, value };
}

export const recordState = (row: { version: number; deletedAt: Date | null }) => ({
  version: row.version,
  deleted: row.deletedAt !== null,
});
