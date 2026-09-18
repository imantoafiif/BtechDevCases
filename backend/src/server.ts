import { createApp } from "./app";
import { loadConfig } from "./config/env";
import { openDatabase } from "./db/connection";

const config = loadConfig();
const db = openDatabase(config.databasePath);

const server = createApp({ config, db }).listen(3000);

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => {
    server.close(() => {
      db.close();
      process.exit(0);
    });
  });
}
