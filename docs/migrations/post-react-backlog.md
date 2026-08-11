# Post-React Backlog

Items intentionally excluded from the frontend migration:

- Cursor/infinite pagination for transaction datasets larger than the current 1000-row web request.
- A maintained golden-image visual regression service and baseline storage.
- Book/workspace switch and sharing UI, granular permissions and account-level permissions.
- Contacts/customer/supplier UX, multi-currency and exchange rates.
- PDF/XLSX export, R2 attachments and richer audit-log UI.
- Offline-first browser sync and reconciliation workflows.
- Inventory, warehouse, personnel, task and note modules.
- Expand the OpenAPI document into complete generated public DTO coverage.

These items must not be implemented by moving ledger authority or direct Neon access into the browser.
