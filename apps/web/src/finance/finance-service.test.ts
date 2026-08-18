import type { AuthSession } from "../platform/auth/auth-schemas";
import type { RequestOptions } from "../platform/api/api-client";
import { FinanceService, type FinanceAPIClient } from "./finance-service";

const BOOK_ID = "00000000-0000-4000-8000-000000000001";
const USER_ID = "00000000-0000-4000-8000-000000000002";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000003";
const TRANSACTION_ONE_ID = "00000000-0000-4000-8000-000000000004";
const TRANSACTION_TWO_ID = "00000000-0000-4000-8000-000000000005";
const INSTRUMENT_ID = "00000000-0000-4000-8000-000000000006";
const SALE_ID = "00000000-0000-4000-8000-000000000007";
const SALE_TRANSACTION_ID = "00000000-0000-4000-8000-000000000008";
const COST_CENTER_ID = "00000000-0000-4000-8000-000000000009";

interface RecordedRequest {
  path: string;
  method: string;
  body: unknown;
  idempotencyKey?: string;
}

type MockHandler = (
  path: string,
  options: RequestOptions<unknown>,
) => unknown;

class MockFinanceAPI implements FinanceAPIClient {
  readonly session: AuthSession = {
    accessToken: "access",
    refreshToken: "refresh",
    expiresIn: 900,
    user: { id: USER_ID, email: "test@example.com", displayName: "Test" },
  };

  readonly calls: RecordedRequest[] = [];
  handler: MockHandler = defaultResponse;

  hasSession(): boolean {
    return true;
  }

  async request<TResponse = unknown>(
    path: string,
    options: RequestOptions<TResponse> = {},
  ): Promise<TResponse> {
    this.calls.push({
      path,
      method: options.method ?? "GET",
      body: options.body,
      ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {}),
    });
    const value = await this.handler(path, options);
    return options.schema ? options.schema.parse(value) : (value as TResponse);
  }
}

function defaultResponse(path: string, options: RequestOptions<unknown>): unknown {
  if (path === "/api/v1/books") {
    return {
      items: [
        {
          id: BOOK_ID,
          name: "Kişisel Defter",
          bookType: "PERSONAL",
          baseCurrency: "TRY",
          role: "OWNER",
          version: 1,
        },
      ],
    };
  }
  if (path.startsWith("/api/v1/accounts?")) return { items: [] };
  if (path.startsWith("/api/v1/categories?")) return { items: [] };
  if (path.startsWith("/api/v1/cost-centers?")) return { items: [] };
  if (path.startsWith("/api/v1/transactions?") && options.method !== "POST") {
    return emptyTransactions();
  }
  if (path.startsWith("/api/v1/scheduled-transactions?")) {
    return {
      items: [],
      groups: { overdue: [], today: [], thisWeek: [], thisMonth: [], later: [] },
    };
  }
  if (path.startsWith("/api/v1/reports/dashboard?")) {
    return {
      month: { income: "0", expense: "0" },
      importantAccounts: [],
      recentTransactions: [],
      upcoming: [],
    };
  }
  if (path.startsWith("/api/v1/reports/cash-flow?")) {
    const url = new URL(path, "https://example.test");
    return {
      items: [],
      granularity: url.searchParams.get("granularity") ?? "month",
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
    };
  }
  if (path.startsWith("/api/v1/reports/income-expense?")) {
    return { items: [], costCenters: [] };
  }
  if (path.startsWith("/api/v1/reports/analytics?")) {
    const url = new URL(path, "https://example.test");
    return {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      granularity: url.searchParams.get("granularity") ?? "month",
      currencyCode: "TRY",
      trend: [],
      accountBalances: { accounts: [], items: [] },
      categoryDetail: { breakdown: [], transactions: [] },
      liquidity: { openingBalance: "0", items: [], events: [] },
      netWorth: {
        cashBalance: "0",
        investmentCost: "0",
        investmentValue: "0",
        realizedGain: "0",
        unrealizedGain: "0",
        totalAssets: "0",
        items: [],
      },
    };
  }
  if (path.startsWith("/api/v1/investments/")) return { items: [] };
  if (path.startsWith("/api/v1/currencies?")) return { items: [] };

  throw new Error(`Unexpected request: ${options.method ?? "GET"} ${path}`);
}

function emptyTransactions() {
  return { items: [], openingBalance: "0", nextCursor: null };
}

function transactionResponse(id: string, title: string, runningBalance: string) {
  return {
    items: [
      {
        id,
        transactionNo: id === TRANSACTION_ONE_ID ? "1" : "2",
        type: "INCOME",
        accountId: ACCOUNT_ID,
        accountName: "Banka",
        targetAccountId: null,
        targetAccountName: null,
        title,
        description: null,
        transactionDate: "2026-08-07T12:00:00.000Z",
        dueDate: null,
        status: "POSTED",
        currencyCode: "TRY",
        categoryId: null,
        categoryName: null,
        costCenterId: null,
        costCenterName: null,
        contactId: null,
        version: 1,
        amount: "10.125",
        balanceDelta: "10.125",
        runningBalance,
      },
    ],
    openingBalance: "100.000",
    nextCursor: null,
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function initializedService(
  api = new MockFinanceAPI(),
  randomUUID: () => string = () => "10000000-0000-4000-8000-000000000001",
) {
  const service = new FinanceService(api, {
    now: () => new Date("2026-08-07T12:00:00.000Z"),
    randomUUID,
    sleep: () => Promise.resolve(),
  });
  await service.initialize();
  api.calls.length = 0;
  return { api, service };
}

describe("FinanceService transaction boundaries", () => {
  it("keeps the core application ready when the initial analytics request fails", async () => {
    const api = new MockFinanceAPI();
    api.handler = (path, options) => {
      if (path.startsWith("/api/v1/reports/analytics?")) {
        throw new Error("Report backend unavailable");
      }
      return defaultResponse(path, options);
    };
    const service = new FinanceService(api, {
      now: () => new Date("2026-08-07T12:00:00.000Z"),
      randomUUID: () => "10000000-0000-4000-8000-000000000001",
      sleep: () => Promise.resolve(),
    });

    await service.initialize();

    expect(service.getSnapshot()).toMatchObject({
      phase: "ready",
      reportAnalytics: null,
      reportLoadFailed: true,
    });
  });

  it("serializes an empty account selection as accountIds=none", async () => {
    const { api, service } = await initializedService();

    await service.loadTransactions({ accountIds: [] });

    const request = api.calls.find((call) => call.path.startsWith("/api/v1/transactions?"));
    expect(request).toBeDefined();
    const url = new URL(request!.path, "https://example.test");
    expect(url.searchParams.get("accountIds")).toBe("none");
    expect(url.searchParams.get("accountIds")).not.toBe("all");
  });

  it("serializes the selected cost center in transaction requests", async () => {
    const { api, service } = await initializedService();

    await service.loadTransactions({ costCenterId: COST_CENTER_ID });

    const request = api.calls.find((call) => call.path.startsWith("/api/v1/transactions?"));
    expect(request).toBeDefined();
    const url = new URL(request!.path, "https://example.test");
    expect(url.searchParams.get("costCenterId")).toBe(COST_CENTER_ID);
  });

  it("stores signed cost-center rows returned by the income-expense report", async () => {
    const { api, service } = await initializedService();
    api.handler = (path, options) => {
      if (path.startsWith("/api/v1/reports/income-expense?")) {
        return {
          items: [],
          costCenters: [
            {
              id: COST_CENTER_ID,
              name: "Aile arabası",
              isActive: false,
              amount: "-250.00",
            },
          ],
        };
      }
      return defaultResponse(path, options);
    };

    await service.loadIncomeExpenseReport({ from: "2026-08-01", to: "2026-08-31" });

    expect(service.getSnapshot().reportCostCenters).toEqual([
      {
        id: COST_CENTER_ID,
        name: "Aile arabası",
        isActive: false,
        amount: "-250.00",
      },
    ]);

    const request = api.calls.find((call) => call.path.startsWith("/api/v1/reports/income-expense?"));
    expect(request).toBeDefined();
    const url = new URL(request!.path, "https://example.test");
    expect(url.searchParams.get("from")).toBe("2026-08-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-08-31T23:59:59.999Z");
  });

  it("serializes report account selections without losing date boundaries", async () => {
    const { api, service } = await initializedService();

    await service.loadIncomeExpenseReport({
      from: "2026-07-01",
      to: "2026-08-31",
      accountIds: [ACCOUNT_ID],
    });

    const selected = new URL(api.calls[0]!.path, "https://example.test");
    expect(selected.searchParams.get("accountIds")).toBe(ACCOUNT_ID);
    expect(selected.searchParams.get("from")).toBe("2026-07-01T00:00:00.000Z");
    expect(selected.searchParams.get("to")).toBe("2026-08-31T23:59:59.999Z");

    await service.loadIncomeExpenseReport({ accountIds: [] });
    const none = new URL(api.calls[1]!.path, "https://example.test");
    expect(none.searchParams.get("accountIds")).toBe("none");
  });

  it("loads the five-report analytics suite with shared filters", async () => {
    const { api, service } = await initializedService();

    await service.loadReportAnalytics({
      from: "2026-01-01",
      to: "2026-08-31",
      accountIds: [ACCOUNT_ID],
      granularity: "week",
    });

    const request = api.calls.find((call) => call.path.startsWith("/api/v1/reports/analytics?"));
    expect(request).toBeDefined();
    const url = new URL(request!.path, "https://example.test");
    expect(url.searchParams.get("accountIds")).toBe(ACCOUNT_ID);
    expect(url.searchParams.get("granularity")).toBe("week");
    expect(url.searchParams.get("from")).toBe("2026-01-01T00:00:00.000Z");
    expect(url.searchParams.get("to")).toBe("2026-08-31T23:59:59.999Z");
    expect(service.getSnapshot().reportAnalytics?.currencyCode).toBe("TRY");
  });

  it("uses the cost-center CRUD endpoints with versioned payloads", async () => {
    const { api, service } = await initializedService();
    api.handler = (path, options) => {
      if (path === "/api/v1/cost-centers" && options.method === "POST") {
        return {
          id: COST_CENTER_ID,
          bookId: BOOK_ID,
          name: "Aile arabası",
          description: "Yakıt ve bakım",
          sortOrder: 10,
          isActive: true,
          version: 1,
        };
      }
      if (path === `/api/v1/cost-centers/${COST_CENTER_ID}` && options.method === "PATCH") {
        return {
          id: COST_CENTER_ID,
          bookId: BOOK_ID,
          name: "Günlük araç",
          description: null,
          sortOrder: 20,
          isActive: true,
          version: 2,
        };
      }
      if (path.startsWith(`/api/v1/cost-centers/${COST_CENTER_ID}?`) && options.method === "DELETE") {
        return { id: COST_CENTER_ID, isActive: false, version: 3 };
      }
      return defaultResponse(path, options);
    };

    await service.createCostCenter({
      name: "Aile arabası",
      description: "Yakıt ve bakım",
      sortOrder: 10,
    });
    expect(api.calls.at(-1)).toMatchObject({
      path: "/api/v1/cost-centers",
      method: "POST",
      body: {
        bookId: BOOK_ID,
        name: "Aile arabası",
        description: "Yakıt ve bakım",
        sortOrder: 10,
      },
    });

    await service.updateCostCenter(COST_CENTER_ID, {
      name: "Günlük araç",
      description: null,
      sortOrder: 20,
      version: 1,
    });
    expect(api.calls.at(-1)).toMatchObject({
      path: `/api/v1/cost-centers/${COST_CENTER_ID}`,
      method: "PATCH",
      body: {
        name: "Günlük araç",
        description: null,
        sortOrder: 20,
        version: 1,
      },
    });

    await service.deleteCostCenter(COST_CENTER_ID, 2);
    const deleteCall = api.calls.at(-1)!;
    expect(deleteCall.method).toBe("DELETE");
    const deleteUrl = new URL(deleteCall.path, "https://example.test");
    expect(deleteUrl.pathname).toBe(`/api/v1/cost-centers/${COST_CENTER_ID}`);
    expect(deleteUrl.searchParams.get("version")).toBe("2");
  });

  it("does not let a stale filtered transaction response overwrite the newest result", async () => {
    const { api, service } = await initializedService();
    const older = deferred<ReturnType<typeof transactionResponse>>();
    const newer = deferred<ReturnType<typeof transactionResponse>>();
    api.handler = (path, options) => {
      if (path.startsWith("/api/v1/transactions?")) {
        const from = new URL(path, "https://example.test").searchParams.get("from");
        return from?.startsWith("2026-01-01") ? older.promise : newer.promise;
      }
      return defaultResponse(path, options);
    };

    const olderLoad = service.loadTransactions({ from: "2026-01-01" });
    const newerLoad = service.loadTransactions({ from: "2026-02-01" });
    newer.resolve(transactionResponse(TRANSACTION_TWO_ID, "Newest", "200.125"));
    const newerResult = await newerLoad;
    older.resolve(transactionResponse(TRANSACTION_ONE_ID, "Stale", "110.125"));
    const olderResult = await olderLoad;

    expect(newerResult.applied).toBe(true);
    expect(olderResult.applied).toBe(false);
    expect(service.getSnapshot().transactions[0]?.title).toBe("Newest");
    expect(service.getSnapshot().transactions[0]?.runningBalance).toBe("200.125");
    expect(service.getSnapshot().transactions[0]?.ui.runningBalance).toBe(200.125);
  });

  it("assigns independent operation and Idempotency-Key values to transaction writes", async () => {
    const ids = [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
    ];
    const { api, service } = await initializedService(new MockFinanceAPI(), () => ids.shift()!);
    api.handler = (path, options) => {
      if (path === "/api/v1/transactions" && options.method === "POST") {
        return {
          id: TRANSACTION_ONE_ID,
          type: "INCOME",
          title: "Maaş",
          status: "POSTED",
          currencyCode: "TRY",
          version: 1,
        };
      }
      return defaultResponse(path, options);
    };

    await service.createTransaction({
      type: "INCOME",
      title: "Maaş",
      amount: "123.45",
      accountId: ACCOUNT_ID,
      transactionDate: "2026-08-07T12:00:00.000Z",
    });

    const call = api.calls.at(-1)!;
    const body = call.body as { clientOperationId: string };
    expect(call.idempotencyKey).toBe("10000000-0000-4000-8000-000000000002");
    expect(body.clientOperationId).toBe("10000000-0000-4000-8000-000000000001");
    expect(call.idempotencyKey).not.toBe(body.clientOperationId);
  });

  it("assigns two distinct client operation IDs when a sale is updated", async () => {
    const ids = [
      "20000000-0000-4000-8000-000000000001",
      "20000000-0000-4000-8000-000000000002",
    ];
    const { api, service } = await initializedService(new MockFinanceAPI(), () => ids.shift()!);
    api.handler = (path, options) => {
      if (path === `/api/v1/investments/sales/${SALE_ID}` && options.method === "PATCH") {
        return {
          id: SALE_ID,
          bookId: BOOK_ID,
          instrumentId: INSTRUMENT_ID,
          instrumentName: "Fon",
          symbol: null,
          currencyCode: "TRY",
          destinationAccountId: ACCOUNT_ID,
          destinationAccountName: "Banka",
          transactionId: SALE_TRANSACTION_ID,
          quantity: "2",
          unitPrice: "25",
          proceeds: "50",
          costBasis: "40",
          gain: "10",
          soldAt: "2026-08-07T12:00:00.000Z",
          notes: null,
          version: 2,
        };
      }
      return defaultResponse(path, options);
    };

    await service.updateSale(SALE_ID, {
      instrumentId: INSTRUMENT_ID,
      destinationAccountId: ACCOUNT_ID,
      quantity: "2",
      unitPrice: "25",
      soldAt: "2026-08-07T12:00:00.000Z",
      version: 1,
    });

    const body = api.calls.at(-1)!.body as {
      clientOperationId: string;
      reversalClientOperationId: string;
    };
    expect(body.clientOperationId).toBe("20000000-0000-4000-8000-000000000001");
    expect(body.reversalClientOperationId).toBe(
      "20000000-0000-4000-8000-000000000002",
    );
    expect(body.clientOperationId).not.toBe(body.reversalClientOperationId);
  });
});
