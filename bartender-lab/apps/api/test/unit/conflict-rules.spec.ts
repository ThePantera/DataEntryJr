import { decideVersionedWrite } from '../../src/sync/conflict-rules';

const live = { version: 3, deleted: false };
const tombstone = { version: 4, deleted: true };

describe('decideVersionedWrite', () => {
  describe('UPSERT', () => {
    it('creates a record that does not exist on the server', () => {
      expect(decideVersionedWrite('UPSERT', null, null)).toEqual({ kind: 'CREATE' });
    });

    it('updates when the client edited the current server version', () => {
      expect(decideVersionedWrite('UPSERT', 3, live)).toEqual({ kind: 'UPDATE' });
    });

    it('is a conflict when the client edited an outdated version (server wins)', () => {
      expect(decideVersionedWrite('UPSERT', 2, live)).toEqual({
        kind: 'CONFLICT',
        reason: 'STALE_VERSION',
      });
    });

    it('is a conflict when the client sends no base version for an existing record', () => {
      expect(decideVersionedWrite('UPSERT', null, live)).toEqual({
        kind: 'CONFLICT',
        reason: 'STALE_VERSION',
      });
    });

    it('is a conflict when the record was deleted on the server (deletion wins)', () => {
      expect(decideVersionedWrite('UPSERT', 3, tombstone)).toEqual({
        kind: 'CONFLICT',
        reason: 'DELETED_ON_SERVER',
      });
    });
  });

  describe('DELETE', () => {
    it('deletes the current server version', () => {
      expect(decideVersionedWrite('DELETE', 3, live)).toEqual({ kind: 'DELETE' });
    });

    it('is a no-op when the record does not exist or is already deleted', () => {
      expect(decideVersionedWrite('DELETE', 1, null)).toEqual({ kind: 'NOOP' });
      expect(decideVersionedWrite('DELETE', 3, tombstone)).toEqual({ kind: 'NOOP' });
    });

    it('is a conflict when the record changed after the client last saw it (edit wins)', () => {
      expect(decideVersionedWrite('DELETE', 2, live)).toEqual({
        kind: 'CONFLICT',
        reason: 'STALE_VERSION',
      });
    });
  });
});
