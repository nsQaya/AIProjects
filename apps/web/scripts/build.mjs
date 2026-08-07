import { cp, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { build } from "esbuild";

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(projectRoot, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(join(projectRoot, "public"), dist, { recursive: true });
await cp(join(projectRoot, "src"), join(dist, "src"), { recursive: true });
await build({
  entryPoints:[join(projectRoot,"src","App","main.js")],
  outfile:join(dist,"app.js"),
  bundle:true,
  format:"esm",
  target:["es2022"],
  minify:true,
  legalComments:"none"
});

console.log("DefterX web assets built in apps/web/dist");
