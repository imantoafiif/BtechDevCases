import { describe, expect, it, vi } from 'vitest';
import { createAuthService } from '../../src/modules/auth/auth.service';
import type { PasswordHasher } from '../../src/modules/auth/password.service';
import type { TokenClaims, TokenService } from '../../src/modules/auth/token.service';
import {
  DuplicateEmailError,
  type UserRecord,
  type UserRepository,
} from '../../src/modules/users/user.repository';
import { testClock, testConfig } from '../helpers/test-app';

const jane: UserRecord = {
  id: 'user-1',
  email: 'jane@example.com',
  passwordHash: 'hashed:secret123',
  createdAt: '2026-09-17T10:00:00.000Z',
  updatedAt: '2026-09-17T10:00:00.000Z',
};

function setup(existingUsers: UserRecord[] = [jane]) {
  const users: UserRepository = {
    findByEmail: vi.fn(async (email) => existingUsers.find((u) => u.email === email)),
    findById: vi.fn(async (id) => existingUsers.find((u) => u.id === id)),
    create: vi.fn(async ({ email, passwordHash }) => {
      if (existingUsers.some((u) => u.email === email)) throw new DuplicateEmailError();
      return { ...jane, id: 'user-2', email, passwordHash };
    }),
  };
  const hasher: PasswordHasher = {
    hash: vi.fn(async (password) => `hashed:${password}`),
    compare: vi.fn(async (password, hash) => hash === `hashed:${password}`),
  };
  const tokens: TokenService = {
    sign: vi.fn(async (user, authTime) => `token-for:${user.id}:${authTime ?? 'now'}`),
    verify: vi.fn(),
  };
  const clock = testClock();
  const { jwt } = testConfig();
  const auth = createAuthService({ users, hasher, tokens, jwt, clock: clock.now });
  return { auth, users, hasher, tokens, clock };
}

function claimsFor(user: UserRecord, authTime: number): TokenClaims {
  return { sub: user.id, email: user.email, authTime, iat: authTime, exp: authTime + 900 };
}

describe('auth service', () => {
  it('registers a user with a hashed password', async () => {
    const { auth, users } = setup([]);
    const result = await auth.register({
      email: 'new@example.com',
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(users.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      passwordHash: 'hashed:secret123',
    });
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects registering an existing email with EMAIL_TAKEN', async () => {
    const { auth } = setup();
    await expect(
      auth.register({ email: jane.email, password: 'secret123', confirmPassword: 'secret123' }),
    ).rejects.toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('logs in with correct credentials', async () => {
    const { auth } = setup();
    const result = await auth.login({ email: jane.email, password: 'secret123' });
    expect(result).toEqual({
      accessToken: 'token-for:user-1:now',
      tokenType: 'Bearer',
      expiresIn: 900,
      user: { id: 'user-1', email: jane.email, createdAt: jane.createdAt },
    });
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const { auth } = setup();
    await expect(auth.login({ email: jane.email, password: 'wrong' })).rejects.toMatchObject({
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('still compares a password for an unknown email, so timing does not leak', async () => {
    const { auth, hasher } = setup();
    await expect(
      auth.login({ email: 'nobody@example.com', password: 'secret123' }),
    ).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
    expect(hasher.compare).toHaveBeenCalledTimes(1);
  });

  it('renews a token and keeps the original login time', async () => {
    const { auth, clock } = setup();
    const loginTime = Math.floor(clock.now() / 1000);
    clock.advance(10 * 60_000);

    const result = await auth.renew(claimsFor(jane, loginTime));
    expect(result.accessToken).toBe(`token-for:user-1:${loginTime}`);
  });

  it('refuses to renew past the absolute session limit', async () => {
    const { auth, clock } = setup();
    const loginTime = Math.floor(clock.now() / 1000);
    clock.advance(8 * 60 * 60_000 + 1_000);

    await expect(auth.renew(claimsFor(jane, loginTime))).rejects.toMatchObject({
      status: 401,
      code: 'SESSION_EXPIRED',
    });
  });

  it('builds the welcome message', async () => {
    const { auth, clock } = setup();
    const result = await auth.me(claimsFor(jane, Math.floor(clock.now() / 1000)));
    expect(result.message).toBe('Hello jane@example.com, welcome back');
  });

  it('rejects a token for a user that no longer exists', async () => {
    const { auth } = setup([]);
    await expect(auth.me(claimsFor(jane, 0))).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
