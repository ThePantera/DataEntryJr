import { PasswordHasher } from '../../src/auth/password-hasher';

describe('PasswordHasher', () => {
  const hasher = new PasswordHasher(12);

  it('never stores the plain password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    expect(hash).not.toContain('correct horse');
    expect(hash.startsWith('scrypt$')).toBe(true);
  });

  it('verifies the correct password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.verify('correct horse battery staple', hash)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hasher.hash('correct horse battery staple');
    await expect(hasher.verify('Correct horse battery staple', hash)).resolves.toBe(false);
  });

  it('uses a random salt so equal passwords produce different hashes', async () => {
    const [a, b] = await Promise.all([hasher.hash('same-password'), hasher.hash('same-password')]);
    expect(a).not.toEqual(b);
  });

  it('verifies hashes created with a different cost (parameters are stored in the hash)', async () => {
    const hash = await new PasswordHasher(11).hash('portable-password');
    await expect(hasher.verify('portable-password', hash)).resolves.toBe(true);
  });

  it('returns false for malformed hashes instead of throwing', async () => {
    await expect(hasher.verify('anything', 'not-a-hash')).resolves.toBe(false);
    await expect(hasher.verify('anything', 'scrypt$x$y$z$w$v')).resolves.toBe(false);
  });
});
