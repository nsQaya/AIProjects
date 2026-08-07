import { readdir,readFile } from "node:fs/promises";
import { dirname,join,resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const [projectId,branchId,ownerRole,databaseName]=process.argv.slice(2);
if(!projectId||!branchId||!ownerRole||!databaseName)throw new Error("Usage: migrate-live-neon.mjs <project-id> <branch-id> <owner-role> <database>");
if(![ownerRole,databaseName].every(value=>/^[a-z_][a-z0-9_]*$/.test(value)))throw new Error("Unsafe database identifier");
const here=dirname(fileURLToPath(import.meta.url)),root=resolve(here,"..","..",".."),migrations=join(root,"packages","database","migrations"),runtimeRole="defterx_app";

function cli(args){
  const command=process.platform==="win32"?"npx.cmd":"npx";
  const result=spawnSync(command,["--yes","neonctl@2.46.0",...args,"--no-analytics","--no-color"],{cwd:root,encoding:"utf8",windowsHide:true,shell:process.platform==="win32",stdio:["ignore","pipe","pipe"]});
  if(result.status!==0){
    const diagnostic=String(result.stderr||"").split(/\r?\n/).filter(line=>/error|fail|invalid|unknown|denied|forbidden|unauthor/i.test(line)).map(line=>line.replace(/https?:\/\/\S+/g,"[url]").replace(/[A-Za-z0-9_-]{32,}/g,"[redacted]")).slice(-3).join(" | ");
    throw new Error(`Neon CLI request failed${diagnostic?`: ${diagnostic}`:""}`);
  }
  return result.stdout;
}
function jsonFrom(text){const start=text.indexOf("{");if(start<0)throw new Error("Neon API returned no JSON");return JSON.parse(text.slice(start));}
function findPassword(value){
  if(!value||typeof value!=="object")return null;
  if(typeof value.password==="string")return value.password;
  for(const child of Object.values(value)){const found=findPassword(child);if(found)return found;}
  return null;
}
const apiPath=`/projects/${projectId}/branches/${branchId}/roles/${ownerRole}/reset_password`;
const reset=jsonFrom(cli(["api",apiPath,"--method","POST","--output","json"]));
const password=findPassword(reset);
if(!password)throw new Error("Neon password reset response did not contain a password");
const connectionOutput=cli(["connection-string",branchId,"--project-id",projectId,"--role-name",ownerRole,"--database-name",databaseName,"--ssl","require"]);
const rawConnection=connectionOutput.match(/postgres(?:ql)?:\/\/[^\s]+/)?.[0];
if(!rawConnection)throw new Error("Neon connection string could not be obtained");
const connection=new URL(rawConnection);connection.password=password;connection.searchParams.set("sslmode","require");

let client;
for(let attempt=1;attempt<=12;attempt++){
  client=new pg.Client({connectionString:connection.toString(),connectionTimeoutMillis:10000});
  try{await client.connect();break;}catch(error){await client.end().catch(()=>{});client=null;if(attempt===12)throw new Error(`PostgreSQL connection failed (${error?.code||"unknown"})`);await new Promise(resolve=>setTimeout(resolve,2000));}
}
try{
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations(filename TEXT PRIMARY KEY,applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
  const files=(await readdir(migrations)).filter(name=>name.endsWith(".sql")).sort();
  for(const filename of files){
    const exists=await client.query(`SELECT 1 FROM schema_migrations WHERE filename=$1`,[filename]);if(exists.rowCount)continue;
    await client.query("BEGIN");
    try{await client.query(await readFile(join(migrations,filename),"utf8"));await client.query(`INSERT INTO schema_migrations(filename) VALUES($1)`,[filename]);await client.query("COMMIT");console.log(`applied ${filename}`);}
    catch(error){await client.query("ROLLBACK");throw new Error(`Migration failed: ${filename} (${error?.code||"unknown"})`);}
  }
  await client.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO ${runtimeRole}`);
  await client.query(`GRANT USAGE,SELECT,UPDATE ON ALL SEQUENCES IN SCHEMA public TO ${runtimeRole}`);
  await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO ${runtimeRole}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO ${runtimeRole}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT USAGE,SELECT,UPDATE ON SEQUENCES TO ${runtimeRole}`);
  await client.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${ownerRole} IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO ${runtimeRole}`);
  const verification=await client.query(`SELECT (SELECT count(*)::int FROM schema_migrations) migrations,(SELECT count(*)::int FROM categories) categories,(SELECT count(*)::int FROM investment_asset_types) investment_types,has_table_privilege($1,'public.investment_lots','SELECT,INSERT,UPDATE,DELETE') runtime_ready`,[runtimeRole]);
  const row=verification.rows[0];
  if(row.migrations!==files.length||!row.runtime_ready)throw new Error("Live database verification failed");
  console.log(`verified migrations=${row.migrations} categories=${row.categories} investmentTypes=${row.investment_types}`);
}finally{await client.end();}
