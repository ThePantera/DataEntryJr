/**
 * node:sqlite adapter (Node ≥ 22) used by tests and server-side integration tests.
 * Not exported from index.ts: the mobile bundle must never import node:sqlite.
 */
import { DatabaseSync } from 'node:sqlite';
import type { Db, SqlValue } from './db';

export function openNodeDb(path = ':memory:'): Db {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, ...params: SqlValue[]) {
      const result = db.prepare(sql).run(...params);
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getAllAsync<T>(sql: string, ...params: SqlValue[]) {
      return db.prepare(sql).all(...params) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: SqlValue[]) {
      return (db.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async withTransactionAsync(task) {
      db.exec('BEGIN');
      try {
        await task();
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
  };
}
