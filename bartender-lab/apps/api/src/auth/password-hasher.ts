import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

const KEY_LENGTH = 64;
const SALT_LENGTH = 16;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function deriveKey(password: string, salt: Buffer, options: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, KEY_LENGTH, options, (error, key) =>
      error ? reject(error) : resolve(key),
    );
  });
}

function scryptOptions(
  costLog2: number,
  blockSize: number,
  parallelization: number,
): ScryptOptions {
  const N = 2 ** costLog2;
  // scrypt needs ~128·N·r bytes; leave headroom above Node's 32 MiB default.
  return { N, r: blockSize, p: parallelization, maxmem: 256 * N * blockSize };
}

/**
 * Password hashing with scrypt (memory-hard KDF from Node's standard library, no native add-ons).
 * Format: scrypt$<log2 N>$<r>$<p>$<salt base64>$<hash base64>. Parameters travel with the hash,
 * so the cost can be raised later without invalidating existing passwords.
 */
export class PasswordHasher {
  constructor(private readonly costLog2: number) {}

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_LENGTH);
    const key = await deriveKey(
      password,
      salt,
      scryptOptions(this.costLog2, BLOCK_SIZE, PARALLELIZATION),
    );
    return [
      'scrypt',
      this.costLog2,
      BLOCK_SIZE,
      PARALLELIZATION,
      salt.toString('base64'),
      key.toString('base64'),
    ].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const parts = stored.split('$');
    if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
    const [costLog2, blockSize, parallelization] = parts.slice(1, 4).map(Number);
    if (
      !Number.isInteger(costLog2) ||
      costLog2 < 10 ||
      costLog2 > 20 ||
      !Number.isInteger(blockSize) ||
      blockSize < 1 ||
      blockSize > 16 ||
      !Number.isInteger(parallelization) ||
      parallelization < 1 ||
      parallelization > 4
    ) {
      return false;
    }
    const salt = Buffer.from(parts[4], 'base64');
    const expected = Buffer.from(parts[5], 'base64');
    if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;

    const actual = await deriveKey(
      password,
      salt,
      scryptOptions(costLog2, blockSize, parallelization),
    );
    return timingSafeEqual(actual, expected);
  }
}
