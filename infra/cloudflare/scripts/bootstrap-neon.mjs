import { randomBytes } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const [projectId, branchId, ownerRole, databaseName] = process.argv.slice(2);
if (!projectId || !branchId || !ownerRole || !databaseName) {
  throw new Error("Usage: bootstrap-neon.mjs <project-id> <branch-id> <owner-role> <database>");
}
if (![ownerRole, databaseName].every((value) => /^[a-z_][a-z0-9_]*$/.test(value))) {
  throw new Error("Database and role names must be safe PostgreSQL identifiers");
}

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "..", "..", "..");
const migrationsDirectory = join(repositoryRoot, "packages", "database", "migrations");
const apiDirectory = join(repositoryRoot, "apps", "api");
const runtimeRole = "defterx_app";

function runCli(command, args, workingDirectory = repositoryRoot) {
  const executable = process.platform === "win32" ? `${command}.cmd` : command;
  const result = spawnSync(executable, args, {
    cwd: workingDirectory,
    encoding: "utf8",
    windowsHide: true,
    shell: process.platform === "win32",
    stdio: ["ignore", "pipe", "pipe"]
  });
  if (result.status !== 0) throw new Error(`${command} command failed`);
  return result.stdout;
}

function connectionStringFor(role, password, ownerConnectionString) {
  const connection = new URL(ownerConnectionString);
  connection.username = role;
  connection.password = password;
  connection.searchParams.set("sslmode", "require");
  return connection.toString();
}

async function applyMigrations(client) {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    filename TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);

  const files = (await readdir(migrationsDirectory)).filter((name) => name.endsWith(".sql")).sort();
  for (const filename of files) {
    const exists = await client.query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
    if (exists.rowCount) continue;
    await client.query("BEGIN");
    try {
      await client.query(await readFile(join(migrationsDirectory, filename), "utf8"));
      await client.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`applied ${filename}`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

const neonOutput = runCli("npx", [
  "--yes", "neonctl@latest", "connection-string", branchId,
  "--project-id", projectId,
  "--role-name", ownerRole,
  "--database-name", databaseName,
  "--ssl", "require",
  "--no-analytics",
  "--no-color"
]);
const ownerConnectionString = neonOutput.match(/postgres(?:ql)?:\/\/[^\s]+/)?.[0];
if (!ownerConnectionString) throw new Error("Neon connection string could not be obtained");

const runtimePassword = randomBytes(36).toString("base64url");
const rotatedOwnerPassword = randomBytes(36).toString("base64url");
const runtimeConnectionString = connectionStringFor(runtimeRole, runtimePassword, ownerConnectionString);
const client = new pg.Client({ connectionString: ownerConnectionString });

let hyperdriveId;
await client.connect();
try {
  await applyMigrations(client);

  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${runtimeRole}') THEN
      CREATE ROLE ${runtimeRole} LOGIN;
    END IF;
  END $$`);
  await client.query(`ALTER ROLE ${runtimeRole} PASSWORD '${runtimePassword}'`);
  await client.query(`ALTER ROLE ${runtimeRole} SET statement_timeout = '10s'`);
  await client.query(`GRANT CONNECT ON DATABASE ${databaseName} TO ${runtimeRole}`);
  await client.query(`GRANT USAGE ON SCHEMA public TO ${runtimeRole}`);
  await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}`);
  await client.query(`GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole}`);
  await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${runtimeRole}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ${runtimeRole}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO ${runtimeRole}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${runtimeRole}`);

  const hyperdriveOutput = runCli("npx", [
    "wrangler", "hyperdrive", "create", "defterx-postgres",
    "--connection-string", runtimeConnectionString,
    "--sslmode", "require",
    "--caching-disabled"
  ], apiDirectory);
  hyperdriveId = hyperdriveOutput.match(/"id"\s*:\s*"([0-9a-f-]+)"/i)?.[1]
    || hyperdriveOutput.match(/\b([0-9a-f]{32})\b/i)?.[1]
    || hyperdriveOutput.match(/\b([0-9a-f]{8}-[0-9a-f-]{27,})\b/i)?.[1];
  if (!hyperdriveId) throw new Error("Hyperdrive was created but its id could not be parsed");

  await client.query(`ALTER ROLE ${ownerRole} PASSWORD '${rotatedOwnerPassword}'`);
} finally {
  await client.end();
}

console.log(`HYPERDRIVE_ID=${hyperdriveId}`);
console.log("Neon schema and least-privilege runtime role are ready; owner password was rotated.");
