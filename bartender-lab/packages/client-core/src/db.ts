/**
 * Minimal async SQLite interface. expo-sqlite's SQLiteDatabase satisfies it as-is on the phone;
 * tests use the node:sqlite adapter in node-sqlite.ts.
 */
export type SqlValue = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: SqlValue[]): Promise<RunResult>;
  getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

const depth = new WeakMap<Db, number>();

/** Runs `task` in a transaction; nested calls join the outer transaction instead of failing. */
export async function inTransaction<T>(db: Db, task: () => Promise<T>): Promise<T> {
  const current = depth.get(db) ?? 0;
  if (current > 0) return task();
  let result!: T;
  depth.set(db, 1);
  try {
    await db.withTransactionAsync(async () => {
      result = await task();
    });
  } finally {
    depth.set(db, 0);
  }
  return result;
}

export const toBool = (value: number | null | undefined): boolean => value === 1;
export const fromBool = (value: boolean): number => (value ? 1 : 0);
export const nowIso = (): string => new Date().toISOString();
