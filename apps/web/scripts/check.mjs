import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, extname, join } from "node:path";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const roots = [join(projectRoot, "src"), join(projectRoot, "worker"), join(projectRoot, "scripts")];

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : [path];
  }));
  return nested.flat().filter((path) => extname(path) === ".js" || extname(path) === ".mjs");
}

for (const file of (await Promise.all(roots.map(javascriptFiles))).flat()) {
  const result = spawnSync(process.execPath, ["--check", file], { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status || 1);
}

console.log("DefterX web JavaScript syntax check passed");
