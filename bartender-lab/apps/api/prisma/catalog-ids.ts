import { createHash } from 'node:crypto';

/** Namespace for BARTENDER LAB catalog ids. Never change it: ids are shared with installed apps. */
export const CATALOG_NAMESPACE = '0f5a3c1e-7b2d-4c8a-9e61-3d2b8f4a6c17';

/**
 * Deterministic UUID v5 (RFC 4122 §4.3) of `name` in `namespace`. The seed and the catalog
 * bundled in the mobile app derive their ids with it, so both always agree.
 */
export function catalogId(name: string, namespace: string = CATALOG_NAMESPACE): string {
  const hash = createHash('sha1')
    .update(Buffer.from(namespace.replace(/-/g, ''), 'hex'))
    .update(name, 'utf8')
    .digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
