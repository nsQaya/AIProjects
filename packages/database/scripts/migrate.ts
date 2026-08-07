import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const argIndex = process.argv.indexOf("--connection-string");
const connectionString = argIndex >= 0 ? process.argv[argIndex + 1] : process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL or --connection-string is required");

const directory = join(dirname(fileURLToPath(import.meta.url)), "..", "migrations");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  const files = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  for (const filename of files) {
    const exists = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
    if (exists.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(join(directory, filename), "utf8"));
      await client.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await client.end();
}

