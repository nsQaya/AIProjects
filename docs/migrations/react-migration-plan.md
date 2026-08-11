# React Migration Plan

## Principles

- Preserve production behavior and the existing visual system.
- Keep the production Vanilla bundle active until React parity gates pass.
- Keep the backend and financial schema authoritative and unchanged.
- Add only justified dependencies and no large state/UI framework.
- Complete and test one feature phase before moving to the next.

## Phase A — Foundation and authentication

1. Add React, strict TypeScript and Vite configuration.
2. Keep legacy source in place while Vite targets a new React entry.
3. Add runtime configuration, typed session storage, central API client and Zod response boundaries.
4. Add HashRouter, auth provider/guards, login/register and application layout.
5. Add small UI/feedback primitives and reuse existing CSS tokens/classes.
6. Gate: frontend typecheck, component tests and production build.

## Phase B — Settings, categories and reports

1. Add typed category, asset-type, instrument and price API modules.
2. Migrate settings/category management and API/Neon status.
3. Migrate reports while retaining inactive historical categories.
4. Gate: form/category tests, typecheck and build.

## Phase C — Accounts

1. Migrate account grid and account form.
2. Preserve editable type, opening balance, negative-balance option, limit errors and archive semantics.
3. Gate: account form tests, typecheck and build.

## Phase D — Transactions

1. Add feature API, filters, table, running-balance cell and transaction form components.
2. Preserve source/target/category field rules, corrections/reversals and server validation.
3. Preserve API-backed account/date filters, opening carry, chronological range rows and UTF-8 CSV.
4. Gate: transaction form/filter/CSV tests, typecheck and build.

## Phase E — Upcoming

1. Migrate list/status filters and scheduled form.
2. Preserve recurrence-until behavior and realization into one actual transaction.
3. Gate: recurrence/form/status tests, typecheck and build.

## Phase F — Dashboard

1. Migrate metrics/recent/upcoming dashboard sections.
2. Port calendar range utility and the current SVG mixed chart without a chart library.
3. Preserve series toggles, balance accounts, zero suppression and stable overlay tooltip.
4. Gate: range/chart interaction tests, typecheck and build.

## Phase G — Investments

1. Migrate portfolio, lots, prices and sales into a dedicated feature.
2. Preserve non-optimistic create/edit/delete flows and destination-account selection.
3. Gate: buy/price/sale/edit/delete component tests plus live financial API regression.

## Phase H — Parity, cleanup and production

1. Run all local checks and the existing live API/Edge suites against React.
2. Inspect dashboard, accounts, transactions, upcoming and investments at desktop/mobile viewports.
3. Only after green parity, remove legacy JS view/repository/router/build files and old public shell.
4. Simplify package scripts to Vite/typecheck/test/lint/preview/deploy.
5. Update README, progress, backlog and completion report.
6. Deploy Vite output through the existing Cloudflare Worker and rerun live API/Edge E2E.

## Rollback strategy

Production remains on the last known-good Cloudflare web Worker until final deployment. Cloudflare version history provides a release rollback point. No database migration is part of this work.
