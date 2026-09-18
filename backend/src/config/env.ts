import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  JWT_SECRET: z
    .string({ error: "JWT_SECRET is required" })
    .min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(28_800),
  JWT_ISSUER: z.string().min(1).default("btech-auth-api"),
  JWT_AUDIENCE: z.string().min(1).default("btech-auth-web"),
  DATABASE_PATH: z.string().min(1).default("./data/app.db"),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173,http://localhost:8080"),
});

export interface RateLimitRule {
  windowMs: number;
  limit: number;
}

export interface Config {
  port: number;
  jwt: {
    secret: string;
    ttlSeconds: number;
    sessionMaxAgeSeconds: number;
    issuer: string;
    audience: string;
  };
  databasePath: string;
  bcryptCost: number;
  corsOrigins: string[];
  rateLimit: {
    login: RateLimitRule;
    register: RateLimitRule;
  };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues.map(
      (issue) => `  - ${issue.path.join(".")}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${problems.join("\n")}`,
    );
  }

  const vars = result.data;
  return {
    port: vars.PORT,
    jwt: {
      secret: vars.JWT_SECRET,
      ttlSeconds: vars.JWT_TTL_SECONDS,
      sessionMaxAgeSeconds: vars.SESSION_MAX_AGE_SECONDS,
      issuer: vars.JWT_ISSUER,
      audience: vars.JWT_AUDIENCE,
    },
    databasePath: vars.DATABASE_PATH,
    bcryptCost: vars.BCRYPT_COST,
    corsOrigins: vars.CORS_ORIGIN.split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    rateLimit: {
      login: { windowMs: 15 * 60_000, limit: 10 },
      register: { windowMs: 60 * 60_000, limit: 20 },
    },
  };
}
