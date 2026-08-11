export const openApiYaml = `openapi: 3.1.0
info:
  title: DefterX API
  version: 1.0.0
  description: Offline-first personal and small-business finance API. Monetary values are decimal strings.
servers:
  - url: /api/v1
security:
  - bearerAuth: []
components:
  securitySchemes:
    bearerAuth: { type: http, scheme: bearer, bearerFormat: JWT }
  parameters:
    IdempotencyKey:
      name: Idempotency-Key
      in: header
      required: true
      schema: { type: string, maxLength: 200 }
  schemas:
    Money: { type: string, pattern: '^(0|[1-9]\\d{0,13})(\\.\\d{1,6})?$' }
    Error:
      type: object
      required: [error]
      properties:
        error:
          type: object
          required: [code, message]
          properties: { code: { type: string }, message: { type: string }, requestId: { type: string } }
    TransactionMutation:
      type: object
      required: [bookId,type,title,amount,currencyCode,accountId,transactionDate,clientOperationId]
      properties:
        bookId: { type: string, format: uuid }
        type: { enum: [INCOME,EXPENSE,TRANSFER,SALE,PURCHASE,COLLECTION,PAYMENT,OPENING_BALANCE,ADJUSTMENT] }
        title: { type: string, maxLength: 200 }
        amount: { $ref: '#/components/schemas/Money' }
        currencyCode: { type: string, pattern: '^[A-Z]{3}$' }
        accountId: { type: string, format: uuid }
        targetAccountId: { type: string, format: uuid }
        categoryId: { type: string, format: uuid }
        costCenterId: { type: [string, 'null'], format: uuid }
        contactId: { type: string, format: uuid }
        transactionDate: { type: string, format: date-time }
        dueDate: { type: string, format: date-time }
        description: { type: string, maxLength: 2000 }
        clientOperationId: { type: string, format: uuid }
paths:
  /auth/register:
    post: { security: [], summary: Register, responses: { '201': { description: Created }, '422': { description: Validation error } } }
  /auth/login:
    post: { security: [], summary: Login, responses: { '200': { description: Tokens }, '401': { description: Invalid credentials } } }
  /auth/refresh:
    post: { security: [], summary: Rotate refresh token, responses: { '200': { description: Rotated } } }
  /me:
    get: { summary: Current user, responses: { '200': { description: User } } }
  /books:
    get: { summary: List books, responses: { '200': { description: Books } } }
    post: { summary: Create book, responses: { '201': { description: Created } } }
  /books/{bookId}/members:
    get: { summary: List members, parameters: [{ name: bookId, in: path, required: true, schema: { type: string, format: uuid } }], responses: { '200': { description: Members } } }
    post: { summary: Share book, parameters: [{ name: bookId, in: path, required: true, schema: { type: string, format: uuid } }], responses: { '201': { description: Member added } } }
  /accounts:
    get: { summary: List accounts, responses: { '200': { description: Accounts } } }
    post: { summary: Create account, responses: { '201': { description: Created } } }
  /categories:
    get: { summary: List categories, responses: { '200': { description: Categories } } }
    post: { summary: Create category and hidden ledger account, responses: { '201': { description: Created } } }
  /cost-centers:
    get: { summary: List active or all cost centers for a book, responses: { '200': { description: Cost centers } } }
    post: { summary: Create cost center, responses: { '201': { description: Created } } }
  /cost-centers/{costCenterId}:
    patch: { summary: Update or reactivate cost center, responses: { '200': { description: Updated } } }
    delete: { summary: Hard-delete unused or deactivate used cost center, responses: { '200': { description: Deleted or deactivated } } }
  /contacts:
    get: { summary: List contacts, responses: { '200': { description: Contacts } } }
    post: { summary: Create contact and ledger account, responses: { '201': { description: Created } } }
  /transactions:
    get: { summary: List transactions with optional costCenterId filter, responses: { '200': { description: Transactions } } }
    post:
      summary: Post balanced transaction
      parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }]
      requestBody: { required: true, content: { application/json: { schema: { $ref: '#/components/schemas/TransactionMutation' } } } }
      responses: { '201': { description: Posted }, '409': { description: Idempotency conflict }, '422': { description: Invalid ledger mapping } }
  /transactions/{transactionId}/reverse:
    post: { summary: Reverse posted transaction, parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }], responses: { '201': { description: Reversed } } }
  /scheduled-transactions:
    get: { summary: Group upcoming items, responses: { '200': { description: Upcoming groups } } }
    post: { summary: Create one-time or recurring scheduled transactions, responses: { '201': { description: Created } } }
  /scheduled-transactions/{scheduledId}/realize:
    post: { summary: Atomically post a scheduled item and mark it completed, responses: { '200': { description: Realized and linked transaction } } }
  /recurring-transactions:
    get: { summary: List recurring templates, responses: { '200': { description: Templates } } }
    post: { summary: Create recurring template, responses: { '201': { description: Created } } }
  /reports/dashboard:
    get: { summary: Dashboard aggregates, responses: { '200': { description: Dashboard } } }
  /reports/cash-flow:
    get: { summary: Cash flow grouped by day, week, month or year, responses: { '200': { description: Cash flow periods } } }
  /reports/income-expense:
    get: { summary: Income and expense by category with signed cost-center breakdown, responses: { '200': { description: Report } } }
  /reports/balances:
    get: { summary: Reconstructed account balances, responses: { '200': { description: Balances } } }
  /reports/receivables-payables:
    get: { summary: Contact balances, responses: { '200': { description: Report } } }
  /sync/push:
    post: { summary: Push offline operation queue, responses: { '200': { description: Per-operation outcomes } } }
  /sync/pull:
    get: { summary: Pull authoritative changes after cursor, responses: { '200': { description: Change page } } }
  /investments/sales:
    get: { summary: List investment sales, responses: { '200': { description: Sales } } }
    post: { summary: Sell investment units and post proceeds to a selected account, responses: { '201': { description: Sold and posted } } }
`;
