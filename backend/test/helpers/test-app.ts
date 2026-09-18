import request from "supertest";
import { createApp } from "../../src/app";
import type { Config } from "../../src/config/env";
import { openDatabase } from "../../src/db/connection";
import { migrate } from "../../src/db/migrate";

export const TEST_SECRET = "test-secret-that-is-at-least-32-characters-long";

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: 0,
    jwt: {
      secret: TEST_SECRET,
      ttlSeconds: 900,
      sessionMaxAgeSeconds: 8 * 60 * 60,
      issuer: "btech-auth-api",
      audience: "btech-auth-web",
    },
    databasePath: ":memory:",
    bcryptCost: 4,
    corsOrigins: ["http://localhost:5173"],
    rateLimit: {
      login: { windowMs: 60_000, limit: 1000 },
      register: { windowMs: 60_000, limit: 1000 },
    },
    ...overrides,
  };
}

export function testClock(start = Date.parse("2026-09-17T10:00:00Z")) {
  let now = start;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

export function createTestApp(configOverrides: Partial<Config> = {}) {
  const db = openDatabase(":memory:");
  migrate(db);
  const clock = testClock();
  const app = createApp({
    config: testConfig(configOverrides),
    db,
    clock: clock.now,
  });
  return { app, db, clock, api: request(app) };
}

export const VALID_USER = {
  email: "jane@example.com",
  password: "secret123",
  confirmPassword: "secret123",
};

export async function registerAndLogin(api: ReturnType<typeof request>) {
  await api.post("/api/auth/register").send(VALID_USER).expect(201);
  const response = await api
    .post("/api/auth/login")
    .send({ email: VALID_USER.email, password: VALID_USER.password })
    .expect(200);
  return response.body.accessToken as string;
}
