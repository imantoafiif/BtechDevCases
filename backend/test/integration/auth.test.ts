import { decodeJwt } from "jose";
import { describe, expect, it } from "vitest";
import {
  createTestApp,
  registerAndLogin,
  VALID_USER,
} from "../helpers/test-app";

const MINUTE = 60_000;

describe("POST /api/auth/register", () => {
  it("creates a user and stores a bcrypt hash", async () => {
    const { api, db } = createTestApp();

    const response = await api
      .post("/api/auth/register")
      .send(VALID_USER)
      .expect(201);

    expect(response.body.user).toMatchObject({ email: "jane@example.com" });
    expect(response.body.user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.stringify(response.body)).not.toMatch(/password/i);

    const row = db.prepare("SELECT password_hash FROM users").get() as {
      password_hash: string;
    };
    expect(row.password_hash).toMatch(/^\$2[aby]\$/);
  });

  it("normalizes the email", async () => {
    const { api } = createTestApp();
    const response = await api
      .post("/api/auth/register")
      .send({ ...VALID_USER, email: "  Jane@Example.COM " })
      .expect(201);
    expect(response.body.user.email).toBe("jane@example.com");
  });

  it.each([
    ["an invalid email", { email: "nope" }, "email"],
    [
      "a short password",
      { password: "abc1", confirmPassword: "abc1" },
      "password",
    ],
    [
      "a password without a digit",
      { password: "abcdefgh", confirmPassword: "abcdefgh" },
      "password",
    ],
    [
      "mismatched passwords",
      { confirmPassword: "secret124" },
      "confirmPassword",
    ],
  ])("returns 400 for %s", async (_, override, field) => {
    const { api } = createTestApp();
    const response = await api
      .post("/api/auth/register")
      .send({ ...VALID_USER, ...override })
      .expect(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details[field]).toHaveLength(1);
  });

  it("returns 400 listing every missing field", async () => {
    const { api } = createTestApp();
    const response = await api.post("/api/auth/register").send({}).expect(400);
    expect(Object.keys(response.body.error.details).sort()).toEqual([
      "confirmPassword",
      "email",
      "password",
    ]);
  });

  it("returns 409 for an email that is already registered, ignoring case", async () => {
    const { api } = createTestApp();
    await api.post("/api/auth/register").send(VALID_USER).expect(201);

    const response = await api
      .post("/api/auth/register")
      .send({ ...VALID_USER, email: "JANE@example.com" })
      .expect(409);
    expect(response.body.error.code).toBe("EMAIL_TAKEN");
  });
});

describe("POST /api/auth/login", () => {
  it("returns a JWT containing the user id and email", async () => {
    const { api } = createTestApp();
    const register = await api
      .post("/api/auth/register")
      .send(VALID_USER)
      .expect(201);

    const response = await api
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: VALID_USER.password })
      .expect(200);

    expect(response.body).toMatchObject({
      tokenType: "Bearer",
      expiresIn: 900,
    });
    expect(decodeJwt(response.body.accessToken)).toMatchObject({
      sub: register.body.user.id,
      email: "jane@example.com",
    });
  });

  it("returns the same 401 for a wrong password and an unknown email", async () => {
    const { api } = createTestApp();
    await api.post("/api/auth/register").send(VALID_USER).expect(201);

    const wrongPassword = await api
      .post("/api/auth/login")
      .send({ email: VALID_USER.email, password: "wrong-pass1" })
      .expect(401);
    const unknownEmail = await api
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: "wrong-pass1" })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 429 after too many failed attempts", async () => {
    const { api } = createTestApp({
      rateLimit: {
        login: { windowMs: MINUTE, limit: 2 },
        register: { windowMs: MINUTE, limit: 100 },
      },
    });
    const attempt = () =>
      api
        .post("/api/auth/login")
        .send({ email: VALID_USER.email, password: "wrong-pass1" });

    await attempt().expect(401);
    await attempt().expect(401);
    const response = await attempt().expect(429);
    expect(response.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("GET /api/me", () => {
  it("shows the welcome message using the token from login", async () => {
    const { api } = createTestApp();
    const token = await registerAndLogin(api);

    const response = await api
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    expect(response.body.message).toBe("Hello jane@example.com, welcome back");
  });

  it.each([
    ["no header", undefined],
    ["a malformed header", "Token abc"],
    ["a garbage token", "Bearer not.a.jwt"],
  ])("returns 401 with %s", async (_, header) => {
    const { api } = createTestApp();
    const req = api.get("/api/me");
    if (header) req.set("Authorization", header);
    const response = await req.expect(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 TOKEN_EXPIRED after 15 minutes", async () => {
    const { api, clock } = createTestApp();
    const token = await registerAndLogin(api);

    clock.advance(15 * MINUTE + 6_000); // past expiry + 5s clock tolerance

    const response = await api
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
    expect(response.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("returns 401 when the user no longer exists", async () => {
    const { api, db } = createTestApp();
    const token = await registerAndLogin(api);
    db.prepare("DELETE FROM users").run();

    await api
      .get("/api/me")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
  });
});

describe("POST /api/auth/refresh", () => {
  it("issues a new token with a later expiry that works on /api/me", async () => {
    const { api, clock } = createTestApp();
    const token = await registerAndLogin(api);

    clock.advance(10 * MINUTE);
    const response = await api
      .post("/api/auth/refresh")
      .set("Authorization", `Bearer ${token}`)
      .expect(200);

    const oldClaims = decodeJwt(token);
    const newClaims = decodeJwt(response.body.accessToken);
    expect(newClaims.exp).toBe(oldClaims.exp! + 10 * 60);
    expect(newClaims.auth_time).toBe(oldClaims.auth_time);

    clock.advance(10 * MINUTE);
    await api
      .get("/api/me")
      .set("Authorization", `Bearer ${response.body.accessToken}`)
      .expect(200);
  });

  it("rejects an expired token", async () => {
    const { api, clock } = createTestApp();
    const token = await registerAndLogin(api);

    clock.advance(16 * MINUTE);

    const response = await api
      .post("/api/auth/refresh")
      .set("Authorization", `Bearer ${token}`)
      .expect(401);
    expect(response.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("stops renewing after 8 hours even when the user stays active", async () => {
    const { api, clock } = createTestApp();
    let token = await registerAndLogin(api);

    let lastStatus = 200;
    for (let i = 0; i < 50 && lastStatus === 200; i++) {
      clock.advance(10 * MINUTE);
      const response = await api
        .post("/api/auth/refresh")
        .set("Authorization", `Bearer ${token}`);
      lastStatus = response.status;
      if (response.status === 200) token = response.body.accessToken;
      else expect(response.body.error.code).toBe("SESSION_EXPIRED");
    }
    expect(lastStatus).toBe(401);
  });
});

describe("misc", () => {
  it("GET /api/health returns ok", async () => {
    const { api } = createTestApp();
    await api.get("/api/health").expect(200, { status: "ok" });
  });

  it("allows CORS only for configured origins", async () => {
    const { api } = createTestApp();

    const allowed = await api
      .options("/api/auth/login")
      .set("Origin", "http://localhost:5173")
      .set("Access-Control-Request-Method", "POST")
      .expect(204);
    expect(allowed.headers["access-control-allow-origin"]).toBe(
      "http://localhost:5173",
    );

    const blocked = await api
      .options("/api/auth/login")
      .set("Origin", "http://evil.test")
      .set("Access-Control-Request-Method", "POST");
    expect(blocked.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("returns a JSON 404 for unknown routes", async () => {
    const { api } = createTestApp();
    const response = await api.get("/api/nope").expect(404);
    expect(response.body.error.code).toBe("NOT_FOUND");
  });

  it("returns a JSON 400 for malformed JSON", async () => {
    const { api } = createTestApp();
    const response = await api
      .post("/api/auth/login")
      .set("Content-Type", "application/json")
      .send('{"email": ')
      .expect(400);
    expect(response.body.error).toEqual({
      code: "VALIDATION_ERROR",
      message: "Request body is not valid JSON",
    });
  });
});
