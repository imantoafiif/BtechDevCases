import express from "express";
import helmet from "helmet";
import { notFoundHandler } from "./middleware/error-handler";
import type { Config } from "./config/env";
import type { Db } from "./db/connection";
import { SqliteUserRepository } from "./modules/users/sqlite-user.repository";
import { createTokenService } from "./modules/auth/token.service";
import { createAuthService } from "./modules/auth/auth.service";
import { createBcryptHasher } from "./modules/auth/password.service";

export type Clock = () => number;
export interface AppDeps {
  config: Config;
  db: Db;
  clock?: Clock;
}

export function createApp({ config, db, clock = Date.now }: AppDeps) {
  const users = new SqliteUserRepository(db);
  const tokens = createTokenService(config.jwt, clock);
  const auth = createAuthService({
    users,
    hasher: createBcryptHasher(config.bcryptCost),
    tokens,
    jwt: config.jwt,
    clock,
  });

  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(express.json({ limit: "10kb" }));

  app.use("/api/auth", () => {});
  app.use("/api", (_, res) => {
    res.json({ status: "ok" });
  });

  app.use(notFoundHandler);

  return app;
}
