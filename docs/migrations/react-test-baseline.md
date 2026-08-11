# React Migration Test Baseline

Date: 2026-08-07

This baseline was captured before React migration source changes.

## Local checks

- `npm run check`: passed; API/contracts/database/shared TypeScript checks passed and legacy web JavaScript syntax check passed.
- `npm test`: passed; 5 test files and 19 tests passed.
- PostgreSQL integration group: 5 tests skipped because `TEST_DATABASE_URL` is not configured in the local command environment.
- `npm run build`: passed; contracts/shared TypeScript builds, API Wrangler dry run and legacy web Wrangler dry run all passed.

## Live API baseline

Command:

```text
npm run smoke:live --workspace @defterx/api -- https://defterx-api.agentproje1.workers.dev https://defterx-web.agentproje1.workers.dev
```

Result: passed. Covered CORS, Neon write/read, idempotency, ledger balance, dashboard/cash flow, account limits, scheduled recurrence/realization/status, detailed cash flow, multi-account ledger, opening carry, investment sale/create/edit/delete financial effects, inactive historical category reporting and refresh-token rotation/reuse protection.

## Live Edge E2E baseline

Command:

```text
npm run smoke:live --workspace @defterx/web -- https://defterx-web.agentproje1.workers.dev
```

Result: passed. Covered registration/auth, account CRUD/type/limits, transaction dialog and CRUD, target visibility, dialog errors, filters/CSV, multi-account/running/devir, transfers, scheduled recurrence/completion/status, cash-flow ranges/mixed chart/hover/toggles/account filter, logout, categories, investment configuration, buy/value/sale/edit/delete and API status.

## Visual baseline

The existing E2E verifies DOM structure and user behavior but has no stored screenshot-comparison framework. Existing CSS, information architecture and responsive breakpoints are therefore the initial visual source of truth. Critical React screens will receive automated render smoke coverage and manual/Edge viewport inspection. A full golden-image service is deferred unless an existing stable screenshot store is introduced.

## Baseline production versions

- API URL: `https://defterx-api.agentproje1.workers.dev`
- Web URL: `https://defterx-web.agentproje1.workers.dev`
- Baseline was taken after the running-balance and investment-sale edit/delete production validation.
