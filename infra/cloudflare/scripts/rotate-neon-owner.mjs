import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";

const [projectId, branchId, ownerRole, databaseName] = process.argv.slice(2);
if (!projectId || !branchId || !ownerRole || !databaseName) {
  throw new Error("Usage: rotate-neon-owner.mjs <project-id> <branch-id> <owner-role> <database>");
}
if (![ownerRole, databaseName].every((value) => /^[a-z_][a-z0-9_]*$/.test(value))) {
  throw new Error("Database and role names must be safe PostgreSQL identifiers");
}

const executable = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(executable, [
  "--yes", "neonctl@latest", "connection-string", branchId,
  "--project-id", projectId,
  "--role-name", ownerRole,
  "--database-name", databaseName,
  "--ssl", "require",
  "--no-analytics",
  "--no-color"
], {
  encoding: "utf8",
  windowsHide: true,
  shell: process.platform === "win32",
  stdio: ["ignore", "pipe", "pipe"]
});
if (result.status !== 0) throw new Error("Neon connection command failed");

const connectionString = result.stdout.match(/postgres(?:ql)?:\/\/[^\s]+/)?.[0];
if (!connectionString) throw new Error("Neon connection string could not be obtained");

const rotatedPassword = randomBytes(36).toString("base64url");
const client = new pg.Client({ connectionString });
await client.connect();
try {
  await client.query(`ALTER ROLE ${ownerRole} PASSWORD '${rotatedPassword}'`);
} finally {
  await client.end();
}

console.log("Neon owner password was rotated and the initially displayed credential is invalid.");
