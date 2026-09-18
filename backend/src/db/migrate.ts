import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Db } from "./connection";

const MIGRATIONS_DIR = fileURLToPath(new URL("./migrations", import.meta.url));

export function migrate(db: Db) {
  const currentVersion = db.pragma("user_version", { simple: true }) as number;

  const migrations = readdirSync(MIGRATIONS_DIR)
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .map((file) => ({ version: Number.parseInt(file, 10), file }))
    .sort((a, b) => a.version - b.version);

  for (const { version, file } of migrations) {
    if (version <= currentVersion) continue;
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    db.transaction(() => {
      db.exec(sql);
      db.pragma(`user_version = ${version}`);
    })();
  }
}
