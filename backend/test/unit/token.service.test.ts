import { decodeJwt, SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { createTokenService } from '../../src/modules/auth/token.service';
import { testClock, testConfig } from '../helpers/test-app';

const user = { id: 'user-1', email: 'jane@example.com' };

function setup() {
  const clock = testClock();
  const { jwt } = testConfig();
  return { clock, jwt, tokens: createTokenService(jwt, clock.now) };
}

describe('token service', () => {
  it('signs a token with the required claims', async () => {
    const { tokens, clock } = setup();
    const token = await tokens.sign(user);
    const now = Math.floor(clock.now() / 1000);

    expect(decodeJwt(token)).toEqual({
      sub: 'user-1',
      email: 'jane@example.com',
      auth_time: now,
      iat: now,
      exp: now + 900,
      iss: 'btech-auth-api',
      aud: 'btech-auth-web',
    });
  });

  it('keeps the given authTime when renewing', async () => {
    const { tokens } = setup();
    const token = await tokens.sign(user, 12345);
    expect(decodeJwt(token).auth_time).toBe(12345);
  });

  it('verifies a valid token', async () => {
    const { tokens } = setup();
    const claims = await tokens.verify(await tokens.sign(user));
    expect(claims).toMatchObject({ sub: 'user-1', email: 'jane@example.com' });
  });

  it('rejects an expired token with TOKEN_EXPIRED', async () => {
    const { tokens, clock } = setup();
    const token = await tokens.sign(user);
    clock.advance(15 * 60_000 + 6_000); // past expiry + 5s clock tolerance
    await expect(tokens.verify(token)).rejects.toMatchObject({
      status: 401,
      code: 'TOKEN_EXPIRED',
    });
  });

  it('rejects a tampered token', async () => {
    const { tokens } = setup();
    const [header, , signature] = (await tokens.sign(user)).split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ sub: 'admin', email: 'x@y.z' })).toString(
      'base64url',
    );
    await expect(tokens.verify(`${header}.${forgedPayload}.${signature}`)).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects a token signed with another secret', async () => {
    const { tokens, jwt } = setup();
    const other = createTokenService({
      ...jwt,
      secret: 'another-secret-that-is-also-32-chars-long',
    });
    await expect(tokens.verify(await other.sign(user))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });

  it('rejects an unsigned (alg: none) token', async () => {
    const { tokens, clock } = setup();
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
    const now = Math.floor(clock.now() / 1000);
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: 'user-1',
      email: 'jane@example.com',
      auth_time: now,
      iat: now,
      exp: now + 900,
      iss: 'btech-auth-api',
      aud: 'btech-auth-web',
    })}.`;
    await expect(tokens.verify(unsigned)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects a token with the wrong issuer or audience', async () => {
    const { tokens, jwt, clock } = setup();
    const key = new TextEncoder().encode(jwt.secret);
    const now = Math.floor(clock.now() / 1000);
    const build = (issuer: string, audience: string) =>
      new SignJWT({ email: 'jane@example.com', auth_time: now })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject('user-1')
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt(now)
        .setExpirationTime(now + 900)
        .sign(key);

    await expect(tokens.verify(await build('someone-else', jwt.audience))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    await expect(tokens.verify(await build(jwt.issuer, 'someone-else'))).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
  });
});
