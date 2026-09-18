import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../src/config/env';
import { TEST_SECRET } from '../helpers/test-app';

describe('loadConfig', () => {
  it('applies defaults', () => {
    const config = loadConfig({ JWT_SECRET: TEST_SECRET });
    expect(config).toMatchObject({
      port: 3000,
      jwt: { ttlSeconds: 900, sessionMaxAgeSeconds: 28_800 },
      databasePath: './data/app.db',
      bcryptCost: 12,
      corsOrigins: ['http://localhost:5173', 'http://localhost:8080'],
    });
  });

  it('parses numbers and the CORS origin list', () => {
    const config = loadConfig({
      JWT_SECRET: TEST_SECRET,
      PORT: '4000',
      JWT_TTL_SECONDS: '60',
      CORS_ORIGIN: 'http://a.test, http://b.test',
    });
    expect(config.port).toBe(4000);
    expect(config.jwt.ttlSeconds).toBe(60);
    expect(config.corsOrigins).toEqual(['http://a.test', 'http://b.test']);
  });

  it('fails when JWT_SECRET is missing', () => {
    expect(() => loadConfig({})).toThrow(/JWT_SECRET: JWT_SECRET is required/);
  });

  it('fails when JWT_SECRET is shorter than 32 characters', () => {
    expect(() => loadConfig({ JWT_SECRET: 'too-short' })).toThrow(/at least 32 characters/);
  });
});
