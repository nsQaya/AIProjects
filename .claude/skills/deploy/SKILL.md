---
name: deploy
description: >-
  Ship DefterX to production: run pending Neon migrations, rotate the DB owner
  credential, deploy the API and web Cloudflare Workers, verify /health/ready, and
  run the live smoke test. Use whenever asked to deploy, ship, release, push to
  prod, or "canlıya al".
---

# DefterX production deploy

Cloudflare Workers (API + web) + Neon Postgres via Hyperdrive. There is **no CI
deploy** — this runbook is the deploy. Runtime DB role is `defterx_app` (via
Hyperdrive); migrations run as `defterx_owner` with a temporary password.

## Fixed identifiers

| | |
|---|---|
| Neon projectId | `purple-sunset-86462962` |
| Neon branchId | `br-rapid-fog-ag6suw7q` |
| owner role / database | `defterx_owner` / `defterx` |
| API URL | `https://defterx-api.agentproje1.workers.dev` |
| web URL | `https://defterx-web.agentproje1.workers.dev` |

`neonctl` must be authenticated (`NEON_API_KEY` env or `neonctl auth`). On Git Bash
/ Windows prefix neonctl-touching commands with `MSYS_NO_PATHCONV=1` so `/projects/...`
API paths are not mangled. `pg` prints DeprecationWarning + SSL-mode warnings on
every run — that is noise, ignore it.

## Preconditions

1. `npm run check` and `npm test` are green.
2. Know whether this change adds a **new migration** (`packages/database/migrations/NNN_*.sql`).
   If so, before deploying:
   - bump `expectedMigrations` in `apps/api/src/app.ts` to the new count
   - add the new table(s) to the `to_regclass('public.<table>')` list in the same
     file's `/health/ready` query
3. If this change adds a user-facing feature, add a scenario for it to
   `apps/api/scripts/smoke-live.mjs` (and a key in the final `console.log` JSON) so
   step 6 actually exercises it. Follow an existing block — register a second user
   with `smoke-...@defterx.invalid` when the feature needs two accounts.
4. Do **not** `git commit` or push unless the user explicitly asks — deploys go
   straight from the local build via `wrangler deploy`.

## Steps

Run in order. If a step fails, stop and report — **except** step 2, which must
still run if step 1 partially ran (it leaves a live owner credential exposed).

### 1. Run pending migrations against live Neon

```bash
node infra/cloudflare/scripts/migrate-live-neon.mjs purple-sunset-86462962 br-rapid-fog-ag6suw7q defterx_owner defterx
```

Resets the owner password, applies every unapplied `.sql` in migration order,
re-grants `defterx_app` privileges, and verifies. Success looks like:
`applied NNN_*.sql` then `verified migrations=<N> categories=... investmentTypes=...`.
No pending migration → just the `verified` line.

### 2. Rotate the exposed owner credential (always)

```bash
node infra/cloudflare/scripts/rotate-neon-owner.mjs purple-sunset-86462962 br-rapid-fog-ag6suw7q defterx_owner defterx
```

Expect: `Neon owner password was rotated and the initially displayed credential is invalid.`
First run downloads `neonctl@latest` — can take a minute; run it in the background
if it stalls.

### 3. Deploy the API Worker

```bash
npm run deploy:api
```

Note the `Current Version ID`.

### 4. Verify API readiness

```bash
curl -s https://defterx-api.agentproje1.workers.dev/health/ready
```

Require `"status":"ready"` with every check `true` (`database`, `migrations`,
`schema`, `tablePrivileges`, `sequencePrivileges`, `authSecrets`). `migrations:false`
means `expectedMigrations` in `app.ts` is stale vs. the DB — fix and redeploy API.

### 5. Deploy the web Worker

```bash
npm run deploy:web
```

Builds Vite `dist` then deploys. Note the `Current Version ID`.

### 6. Live smoke test

```bash
node apps/api/scripts/smoke-live.mjs https://defterx-api.agentproje1.workers.dev https://defterx-web.agentproje1.workers.dev
```

Require the final JSON to be `"status": "passed"` with every scenario key
`"passed"`. This creates a throwaway `smoke+<runId>@defterx.invalid` user and
book in the real DB (never cleaned up — harmless, isolated).

## Report

Give the user a table: migration result, API version id, `/health/ready` verdict,
web version id, smoke verdict. State plainly if anything failed.

## Rollback

- Workers: `npx wrangler rollback --config apps/api/wrangler.jsonc` (or the web
  config) to the previous version id.
- Migrations are forward-only — never edit an applied file; write a new
  compensating migration and redeploy.
