import express from "express";
import cors from "cors";
import helmet from "helmet";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import type { Config } from "./config/env";
import type { Db } from "./db/connection";
import { SqliteUserRepository } from "./modules/users/sqlite-user.repository";
import { createTokenService } from "./modules/auth/token.service";
import { createAuthService } from "./modules/auth/auth.service";
import { createBcryptHasher } from "./modules/auth/password.service";
import { createAuthRouter } from "./modules/auth/auth.routes";
import { createMeRouter } from "./modules/users/me.routes";

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
  app.use(
    cors({
      origin: config.corsOrigins,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    }),
  );
  app.use(express.json({ limit: "10kb" }));

  app.use("/api/auth", createAuthRouter(auth, tokens, config));
  app.use("/api", createMeRouter(auth, tokens));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
