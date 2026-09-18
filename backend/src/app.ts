import express from "express";
import helmet from "helmet";
import { notFoundHandler } from "./middleware/error-handler";

export interface AppDeps {}

export function createApp() {
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
