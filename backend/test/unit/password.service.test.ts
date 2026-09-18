import { describe, expect, it } from 'vitest';
import { createBcryptHasher } from '../../src/modules/auth/password.service';

describe('bcrypt password hasher', () => {
  const hasher = createBcryptHasher(4);

  it('hashes and verifies a password', async () => {
    const hash = await hasher.hash('secret123');
    expect(hash).not.toContain('secret123');
    expect(hash).toMatch(/^\$2[aby]\$04\$/);
    await expect(hasher.compare('secret123', hash)).resolves.toBe(true);
    await expect(hasher.compare('secret124', hash)).resolves.toBe(false);
  });

  it('salts each hash', async () => {
    expect(await hasher.hash('secret123')).not.toBe(await hasher.hash('secret123'));
  });
});
