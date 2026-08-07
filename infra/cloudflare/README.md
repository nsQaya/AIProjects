# Cloudflare infrastructure

## Bindings

- `HYPERDRIVE`: primary PostgreSQL connection. Ledger data must never be moved to D1.
- `ATTACHMENTS`: private R2 bucket reserved for signed attachment flows in V2; V1 production config does not bind R2 until the account enables it.
- `JOBS`: recurring processing and later reminder jobs. Occurrence uniqueness makes delivery idempotent.
- `RATE_LIMITER`: Cloudflare Rate Limiting binding for authentication endpoints; namespace `1001`, 10 request/60 seconds policy is declared in Wrangler.

Create resources separately per environment and replace ids/names in an environment-specific Wrangler configuration. Do not commit `.dev.vars`, database URLs, JWT secrets, or refresh-token pepper values.

## Deployment order

1. Provision PostgreSQL with TLS, backups and point-in-time recovery.
2. Run all migrations from a controlled CI job.
3. Create Hyperdrive and validate connectivity from a preview Worker.
4. Create private R2 bucket and Queue, then configure the consumer.
5. Add `JWT_SECRET` and `REFRESH_TOKEN_PEPPER` with `wrangler secret put`.
6. Configure an explicit `ALLOWED_ORIGINS` list and Rate Limiting binding.
7. Deploy with `npm run deploy` and check `/health` plus a database-backed smoke test.

Production should use separate preview/production databases, Cloudflare Access for operational tooling, log redaction, database statement timeouts, least-privilege DB credentials, automated backups and alerts for queue dead letters.
