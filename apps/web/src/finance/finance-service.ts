import type {
  BalanceReportResponse,
  BookListItemDTO,
  CorrectTransactionResponse,
  CreateAccountRequest,
  CreateAccountResponse,
  CreateCategoryRequest,
  CreateCategoryResponse,
  CreateCostCenterRequest,
  CreateCostCenterResponse,
  CreateInvestmentAssetTypeRequest,
  CreateInvestmentAssetTypeResponse,
  CreateInvestmentInstrumentRequest,
  CreateInvestmentInstrumentResponse,
  CreateInvestmentLotRequest,
  CreateInvestmentLotResponse,
  CreateInvestmentSaleRequest,
  CreateInvestmentSaleResponse,
  CreateScheduledTransactionRequest,
  CreateScheduledTransactionResponse,
  CreateTransactionRequest,
  CreateTransactionResponse,
  CurrencyListResponse,
  CurrencyRateSyncRunDTO,
  CurrencyRatesAtDateResponse,
  DeleteAccountResponse,
  DeleteCategoryResponse,
  DeleteCostCenterResponse,
  DeleteInvestmentAssetTypeResponse,
  DeleteInvestmentInstrumentResponse,
  DeleteInvestmentLotResponse,
  DeleteInvestmentSaleResponse,
  DeleteScheduledTransactionResponse,
  DisableCurrencyResponse,
  EnableCurrencyResponse,
  IncomeExpenseReportResponse,
  InvestmentPriceDTO,
  InvestmentPricesAtDateResponse,
  MarketPriceSyncRunDTO,
  MarketSymbolListResponse,
  RealizeScheduledTransactionResponse,
  ReceivablePayableReportResponse,
  ReportAnalyticsResponse,
  ReverseTransactionResponse,
  SetInvestmentPriceRequest,
  SetScheduledStatusRequest,
  SetScheduledStatusResponse,
  TransactionListResponse,
  UUID,
  UpdateAccountRequest,
  UpdateAccountResponse,
  UpdateCategoryRequest,
  UpdateCategoryResponse,
  UpdateCostCenterRequest,
  UpdateCostCenterResponse,
  UpdateInvestmentAssetTypeRequest,
  UpdateInvestmentAssetTypeResponse,
  UpdateInvestmentInstrumentRequest,
  UpdateInvestmentInstrumentResponse,
  UpdateInvestmentLotRequest,
  UpdateInvestmentLotResponse,
  UpdateInvestmentSaleRequest,
  UpdateInvestmentSaleResponse,
  UpdateScheduledTransactionRequest,
  UpdateScheduledTransactionResponse,
} from "@defterx/contracts";
import type { AuthSession } from "../platform/auth/auth-schemas";
import type { RequestOptions } from "../platform/api/api-client";
import { APIError } from "../platform/api/api-error";
import {
  buildQuery,
  cashFlowWindow,
  endOfDayBoundary,
  monthStart,
  serializeCashFlowAccountIds,
  serializeTransactionAccountIds,
  startOfDayBoundary,
  type CashFlowRange,
} from "./finance-query";
import {
  createInitialFinanceSnapshot,
  type CashFlowVisibility,
  type FinanceSnapshot,
  type ReportRange,
  type TransactionFilter,
  type UpcomingFilter,
} from "./finance-state";
import {
  accountView,
  cashFlowView,
  dashboardView,
  incomeExpenseReportItemView,
  investmentInstrumentView,
  investmentLotView,
  investmentPortfolioItemView,
  investmentSaleView,
  scheduledTransactionView,
  toUiNumber,
  transactionView,
  type CashFlowView,
  type TransactionView,
} from "./finance-views";
import {
  accountListSchema,
  accountSchema,
  bookListSchema,
  categoryListSchema,
  categorySchema,
  costCenterListSchema,
  costCenterSchema,
  correctTransactionResponseSchema,
  createScheduledTransactionResponseSchema,
  createdBookSchema,
  deleteAccountResponseSchema,
  deleteCategoryResponseSchema,
  deleteCostCenterResponseSchema,
  deleteScheduledTransactionResponseSchema,
  realizeScheduledTransactionResponseSchema,
  scheduledTransactionListSchema,
  scheduledTransactionSchema,
  setScheduledStatusResponseSchema,
  transactionListSchema,
  transactionMutationResultSchema,
} from "./schemas/core";
import {
  deleteInvestmentAssetTypeResponseSchema,
  deleteInvestmentInstrumentResponseSchema,
  deleteInvestmentLotResponseSchema,
  deleteInvestmentSaleResponseSchema,
  investmentAssetTypeListSchema,
  investmentAssetTypeSchema,
  investmentInstrumentListSchema,
  investmentInstrumentSchema,
  investmentLotListSchema,
  investmentLotSchema,
  investmentPortfolioSchema,
  investmentPriceSchema,
  investmentPricesAtDateSchema,
  marketPriceSyncRunSchema,
  marketPriceSyncStatusSchema,
  marketSymbolListSchema,
  investmentSaleListSchema,
  investmentSaleSchema,
} from "./schemas/investments";
import {
  balanceReportSchema,
  cashFlowResponseSchema,
  dashboardReportSchema,
  incomeExpenseReportSchema,
  reportAnalyticsSchema,
  receivablePayableReportSchema,
} from "./schemas/reports";
import {
  currencyListSchema,
  currencyRateSyncRunSchema,
  currencyRateSyncStatusSchema,
  currencyRatesAtDateSchema,
  disableCurrencyResponseSchema,
  enableCurrencyResponseSchema,
} from "./schemas/currencies";

export interface FinanceAPIClient {
  readonly session: AuthSession | null;
  hasSession(): boolean;
  request<TResponse = unknown>(
    path: string,
    options?: RequestOptions<TResponse>,
  ): Promise<TResponse>;
}

export interface FinanceServiceDependencies {
  now?: () => Date;
  randomUUID?: () => UUID;
  sleep?: (milliseconds: number) => Promise<void>;
}

export type CreateFinanceTransactionInput = Omit<
  CreateTransactionRequest,
  "bookId" | "currencyCode" | "clientOperationId"
> & { currencyCode?: string };

export type CreateFinanceAccountInput = Omit<
  CreateAccountRequest,
  "bookId" | "currencyCode"
> & { currencyCode?: string };

export type CreateFinanceCategoryInput = Omit<
  CreateCategoryRequest,
  "bookId" | "currencyCode"
> & { currencyCode?: string };

export type CreateFinanceCostCenterInput = Omit<CreateCostCenterRequest, "bookId">;

export type CreateFinanceScheduledInput = Omit<
  CreateScheduledTransactionRequest,
  "bookId" | "currencyCode"
> & { currencyCode?: string };

export type CreateFinanceAssetTypeInput = Omit<CreateInvestmentAssetTypeRequest, "bookId">;
export type CreateFinanceInstrumentInput = Omit<
  CreateInvestmentInstrumentRequest,
  "bookId" | "currencyCode"
> & { currencyCode?: string };
export type CreateFinanceLotInput = Omit<CreateInvestmentLotRequest, "bookId">;
export type CreateFinanceSaleInput = Omit<
  CreateInvestmentSaleRequest,
  "bookId" | "clientOperationId"
>;
export type UpdateFinanceSaleInput = Omit<
  UpdateInvestmentSaleRequest,
  "clientOperationId" | "reversalClientOperationId"
>;

export interface TransactionLoadResult {
  items: readonly TransactionView[];
  openingBalance: string;
  openingBalanceValue: number;
  nextCursor: string | null;
  applied: boolean;
}

export interface CashFlowLoadResult {
  items: readonly CashFlowView[];
  applied: boolean;
}

type Listener = () => void;
type SnapshotUpdater = (snapshot: FinanceSnapshot) => FinanceSnapshot;

const defaultSleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => globalThis.setTimeout(resolve, milliseconds));

const defaultRandomUUID = (): UUID => globalThis.crypto.randomUUID();

export class FinanceStateError extends Error {
  constructor(message: "AUTH_REQUIRED" | "BOOK_REQUIRED") {
    super(message);
    this.name = "FinanceStateError";
  }
}

/**
 * Typed, server-authoritative finance gateway and external store.
 *
 * Mutations never alter ledger state optimistically. Callers can await a mutation
 * and then call `refresh`; every response is Zod-validated at the API boundary.
 */
export class FinanceService {
  readonly #api: FinanceAPIClient;
  readonly #now: () => Date;
  readonly #randomUUID: () => UUID;
  readonly #sleep: (milliseconds: number) => Promise<void>;
  readonly #listeners = new Set<Listener>();
  #state = createInitialFinanceSnapshot();
  #initializePromise: Promise<FinanceSnapshot> | null = null;
  #initializeSequence = 0;
  #refreshSequence = 0;
  #transactionSequence = 0;
  #cashFlowSequence = 0;
  #reportSequence = 0;
  #balanceReportSequence = 0;
  #receivableReportSequence = 0;

  constructor(api: FinanceAPIClient, dependencies: FinanceServiceDependencies = {}) {
    this.#api = api;
    this.#now = dependencies.now ?? (() => new Date());
    this.#randomUUID = dependencies.randomUUID ?? defaultRandomUUID;
    this.#sleep = dependencies.sleep ?? defaultSleep;
  }

  getSnapshot = (): FinanceSnapshot => this.#state;

  subscribe = (listener: Listener): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  bookId(): UUID {
    return this.#requireBook().id;
  }

  reset(): void {
    this.#initializeSequence += 1;
    this.#refreshSequence += 1;
    this.#transactionSequence += 1;
    this.#cashFlowSequence += 1;
    this.#reportSequence += 1;
    this.#balanceReportSequence += 1;
    this.#receivableReportSequence += 1;
    this.#initializePromise = null;
    this.#replace(createInitialFinanceSnapshot());
  }

  initialize(): Promise<FinanceSnapshot> {
    if (this.#state.phase === "ready" && this.#state.book) {
      return Promise.resolve(this.#state);
    }
    if (this.#initializePromise) return this.#initializePromise;

    const sequence = ++this.#initializeSequence;
    const promise = this.#initialize(sequence).finally(() => {
      if (this.#initializePromise === promise) this.#initializePromise = null;
    });
    this.#initializePromise = promise;
    return this.#initializePromise;
  }

  async #initialize(sequence: number): Promise<FinanceSnapshot> {
    if (!this.#api.hasSession()) throw new FinanceStateError("AUTH_REQUIRED");
    this.#commit((state) => ({
      ...state,
      phase: "loading",
      user: this.#api.session?.user ?? null,
    }));

    try {
      let books = await this.#api.request("/api/v1/books", { schema: bookListSchema });
      let book: BookListItemDTO;
      if (books.items[0]) {
        book = books.items[0];
      } else {
        book = await this.#createInitialBookWithRetry(async () => {
          books = await this.#api.request("/api/v1/books", { schema: bookListSchema });
          return books.items[0] ?? null;
        });
      }

      if (sequence !== this.#initializeSequence) return this.#state;
      this.#commit((state) => ({ ...state, book }));
      return await this.refresh();
    } catch (error) {
      this.#commit((state) => ({ ...state, phase: "idle", refreshing: false }));
      throw error;
    }
  }

  async #createInitialBookWithRetry(
    reload: () => Promise<BookListItemDTO | null>,
  ): Promise<BookListItemDTO> {
    const create = async (): Promise<BookListItemDTO> => {
      const created = await this.#api.request("/api/v1/books", {
        method: "POST",
        body: { name: "Kişisel Defter", bookType: "PERSONAL", baseCurrency: "TRY" },
        schema: createdBookSchema,
      });
      return { ...created, role: "OWNER" };
    };

    try {
      return await create();
    } catch (error) {
      if (!(error instanceof APIError) || error.status < 500) throw error;
      await this.#sleep(350);
      return (await reload()) ?? (await create());
    }
  }

  async refresh(): Promise<FinanceSnapshot> {
    const book = this.#requireBook();
    const refreshSequence = ++this.#refreshSequence;
    const transactionSequence = ++this.#transactionSequence;
    const cashFlowSequence = ++this.#cashFlowSequence;
    const reportSequence = ++this.#reportSequence;
    const revision = this.#now().getTime();
    const baseQuery = buildQuery({ bookId: book.id, _: revision });

    this.#commit((state) => ({ ...state, refreshing: true }));

    try {
      const [
        accountsResponse,
        categoriesResponse,
        costCentersResponse,
        currenciesResponse,
        transactionsResponse,
        scheduledResponse,
      ] =
        await Promise.all([
          this.#api.request(`/api/v1/accounts?${baseQuery}&includeArchived=true`, {
            schema: accountListSchema,
          }),
          this.#api.request(`/api/v1/categories?${baseQuery}&includeInactive=true`, {
            schema: categoryListSchema,
          }),
          this.#api.request(`/api/v1/cost-centers?${baseQuery}&includeInactive=true`, {
            schema: costCenterListSchema,
          }),
          this.#api.request(`/api/v1/currencies?${baseQuery}`, {
            schema: currencyListSchema,
          }),
          this.#api.request(`/api/v1/transactions?${baseQuery}&limit=1000`, {
            schema: transactionListSchema,
          }),
          this.#api.request(`/api/v1/scheduled-transactions?${baseQuery}&view=all`, {
            schema: scheduledTransactionListSchema,
          }),
        ]);

      if (refreshSequence !== this.#refreshSequence) return this.#state;

      const accounts = accountsResponse.items.map(accountView);
      const categories = categoriesResponse.items.map((category) => ({
        ...category,
        ui: { kind: category.categoryType.toLowerCase() as "income" | "expense" },
      }));
      const costCenters = costCentersResponse.items;
      const currencies = currenciesResponse.items;
      const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
      const upcoming = scheduledResponse.items.map((item) =>
        scheduledTransactionView(item, categoryNames),
      );
      const cashflowAccountIds = this.#nextCashFlowAccountIds(accounts);
      const window = cashFlowWindow(this.#state.cashflowRange, this.#now());
      // The dashboard summary always reflects the current month, independent of
      // any date/account filter the user applied on the Reports page.
      const range = { from: monthStart(this.#now()), to: this.#now().toISOString() };
      // Analytics reuses the user's explicit report filter when one is active;
      // otherwise it gets the same fresh month-to-date default as the dashboard.
      const analyticsRange: ReportRange = this.#state.reportRangeExplicit
        ? this.#state.reportRange
        : { ...range, granularity: "month" };

      const [dashboard, cashflow, analytics, types, instruments, lots, sales, portfolio] =
        await Promise.all([
          this.#api.request(
            `/api/v1/reports/dashboard?${buildQuery({ bookId: book.id, ...range, _: revision })}`,
            { schema: dashboardReportSchema },
          ),
          this.#api.request(
            `/api/v1/reports/cash-flow?${buildQuery({
              bookId: book.id,
              from: window.from,
              to: window.to,
              granularity: window.granularity,
              accountIds: serializeCashFlowAccountIds(cashflowAccountIds),
              _: revision,
            })}`,
            { schema: cashFlowResponseSchema },
          ),
          this.#api.request(
            `/api/v1/reports/analytics?${this.#reportQuery(analyticsRange)}`,
            { schema: reportAnalyticsSchema },
          ).then(
            (value) => ({ failed: false as const, value }),
            () => ({ failed: true as const, value: null }),
          ),
          this.#api.request(
            `/api/v1/investments/asset-types?${baseQuery}&includeInactive=true`,
            { schema: investmentAssetTypeListSchema },
          ),
          this.#api.request(
            `/api/v1/investments/instruments?${baseQuery}&includeInactive=true`,
            { schema: investmentInstrumentListSchema },
          ),
          this.#api.request(`/api/v1/investments/lots?${baseQuery}`, {
            schema: investmentLotListSchema,
          }),
          this.#api.request(`/api/v1/investments/sales?${baseQuery}`, {
            schema: investmentSaleListSchema,
          }),
          this.#api.request(`/api/v1/investments/portfolio?${baseQuery}`, {
            schema: investmentPortfolioSchema,
          }),
        ]);

      if (refreshSequence !== this.#refreshSequence) return this.#state;

      this.#commit((state) => ({
        ...state,
        phase: "ready",
        refreshing: false,
        revision: state.revision + 1,
        lastUpdatedAt: this.#now().toISOString(),
        accounts,
        categories,
        costCenters,
        currencies,
        upcoming,
        dashboard: dashboardView(dashboard),
        cashflowAccountIds:
          cashFlowSequence === this.#cashFlowSequence
            ? cashflowAccountIds
            : state.cashflowAccountIds.filter((id) =>
                accounts.some((account) => account.id === id && !account.isArchived),
              ),
        cashflowAccountsInitialized: true,
        investmentTypes: types.items,
        instruments: instruments.items.map(investmentInstrumentView),
        lots: lots.items.map(investmentLotView),
        sales: sales.items.map(investmentSaleView),
        portfolio: portfolio.items.map(investmentPortfolioItemView),
        ...(transactionSequence === this.#transactionSequence
          ? this.#transactionPatch(transactionsResponse, {})
          : {}),
        ...(cashFlowSequence === this.#cashFlowSequence
          ? {
              cashflowRange: window.selection,
              cashflowMeta: {
                from: cashflow.from,
                to: cashflow.to,
                granularity: cashflow.granularity,
              },
              cashflow: cashflow.items.map((item) => cashFlowView(item, cashflow.granularity)),
            }
          : {}),
        ...(reportSequence === this.#reportSequence
          ? {
              reportRange: analyticsRange,
              reportAnalytics: analytics.value ?? state.reportAnalytics,
              reportLoadFailed: analytics.failed,
            }
          : {}),
      }));
      return this.#state;
    } catch (error) {
      if (refreshSequence === this.#refreshSequence) {
        this.#commit((state) => ({ ...state, refreshing: false }));
      }
      throw error;
    }
  }

  async loadTransactions(filter: TransactionFilter = {}): Promise<TransactionLoadResult> {
    const sequence = ++this.#transactionSequence;
    const stableFilter: TransactionFilter = {
      ...filter,
      accountIds: filter.accountIds ? [...filter.accountIds] : undefined,
    };
    const response: TransactionListResponse = await this.#api.request(
      `/api/v1/transactions?${buildQuery({
        bookId: this.bookId(),
        limit: 1000,
        accountIds: serializeTransactionAccountIds(stableFilter.accountIds),
        categoryId: stableFilter.categoryId,
        costCenterId: stableFilter.costCenterId,
        from: stableFilter.from ? startOfDayBoundary(stableFilter.from) : undefined,
        to: stableFilter.to ? endOfDayBoundary(stableFilter.to) : undefined,
        _: this.#now().getTime(),
      })}`,
      { schema: transactionListSchema },
    );
    const items = response.items.map(transactionView);
    const applied = sequence === this.#transactionSequence;
    if (applied) this.#commit((state) => ({ ...state, ...this.#transactionPatch(response, stableFilter) }));
    return {
      items,
      openingBalance: response.openingBalance,
      openingBalanceValue: toUiNumber(response.openingBalance),
      nextCursor: response.nextCursor,
      applied,
    };
  }

  async loadCashflow(selection: CashFlowRange): Promise<CashFlowLoadResult> {
    return this.#requestCashflow(selection, this.#state.cashflowAccountIds, false);
  }

  async loadCashflowAccounts(accountIds: readonly UUID[]): Promise<CashFlowLoadResult> {
    const activeIds = new Set(
      this.#state.accounts.filter((account) => !account.isArchived).map((account) => account.id),
    );
    const selected = [...new Set(accountIds)].filter((id) => activeIds.has(id));
    return this.#requestCashflow(this.#state.cashflowRange, selected, true);
  }

  async #requestCashflow(
    selection: CashFlowRange,
    accountIds: readonly UUID[],
    updateAccounts: boolean,
  ): Promise<CashFlowLoadResult> {
    const sequence = ++this.#cashFlowSequence;
    const window = cashFlowWindow(selection, this.#now());
    const response = await this.#api.request(
      `/api/v1/reports/cash-flow?${buildQuery({
        bookId: this.bookId(),
        from: window.from,
        to: window.to,
        granularity: window.granularity,
        accountIds: serializeCashFlowAccountIds(accountIds),
        _: this.#now().getTime(),
      })}`,
      { schema: cashFlowResponseSchema },
    );
    const items = response.items.map((item) => cashFlowView(item, response.granularity));
    const applied = sequence === this.#cashFlowSequence;
    if (applied) {
      this.#commit((state) => ({
        ...state,
        cashflowRange: selection,
        cashflowMeta: {
          from: response.from,
          to: response.to,
          granularity: response.granularity,
        },
        cashflow: items,
        ...(updateAccounts ? { cashflowAccountIds: [...accountIds] } : {}),
      }));
    }
    return { items, applied };
  }

  setCashflowVisibility(patch: Partial<CashFlowVisibility>): void {
    this.#commit((state) => ({
      ...state,
      cashflowVisible: { ...state.cashflowVisible, ...patch },
    }));
  }

  setUpcomingFilter(upcomingFilter: UpcomingFilter): void {
    this.#commit((state) => ({ ...state, upcomingFilter }));
  }

  async loadIncomeExpenseReport(range: ReportRange = {}): Promise<IncomeExpenseReportResponse> {
    const sequence = ++this.#reportSequence;
    const stableRange = { ...range };
    const response: IncomeExpenseReportResponse = await this.#api.request(
      `/api/v1/reports/income-expense?${this.#reportQuery(stableRange)}`,
      { schema: incomeExpenseReportSchema },
    );
    if (sequence === this.#reportSequence) {
      this.#commit((state) => ({
        ...state,
        reportRange: stableRange,
        reportItems: response.items.map(incomeExpenseReportItemView),
        reportCostCenters: response.costCenters,
      }));
    }
    return response;
  }

  async loadReportAnalytics(range: ReportRange = {}): Promise<ReportAnalyticsResponse> {
    const sequence = ++this.#reportSequence;
    const stableRange: ReportRange = {
      ...range,
      accountIds: range.accountIds ? [...range.accountIds] : undefined,
      granularity: range.granularity ?? "month",
    };
    let response: ReportAnalyticsResponse;
    try {
      response = await this.#api.request(
        `/api/v1/reports/analytics?${this.#reportQuery(stableRange)}`,
        { schema: reportAnalyticsSchema },
      );
    } catch (error) {
      if (sequence === this.#reportSequence) {
        this.#commit((state) => ({ ...state, reportLoadFailed: true }));
      }
      throw error;
    }
    if (sequence === this.#reportSequence) {
      this.#commit((state) => ({
        ...state,
        reportRange: stableRange,
        reportRangeExplicit: true,
        reportAnalytics: response,
        reportLoadFailed: false,
      }));
    }
    return response;
  }

  async loadBalanceReport(range: ReportRange = {}): Promise<BalanceReportResponse> {
    const sequence = ++this.#balanceReportSequence;
    const response: BalanceReportResponse = await this.#api.request(
      `/api/v1/reports/balances?${this.#reportQuery(range)}`,
      { schema: balanceReportSchema },
    );
    if (sequence === this.#balanceReportSequence) {
      this.#commit((state) => ({ ...state, balanceReportItems: response.items }));
    }
    return response;
  }

  async loadReceivablePayableReport(
    range: ReportRange = {},
  ): Promise<ReceivablePayableReportResponse> {
    const sequence = ++this.#receivableReportSequence;
    const response: ReceivablePayableReportResponse = await this.#api.request(
      `/api/v1/reports/receivables-payables?${this.#reportQuery(range)}`,
      { schema: receivablePayableReportSchema },
    );
    if (sequence === this.#receivableReportSequence) {
      this.#commit((state) => ({ ...state, receivablePayableReportItems: response.items }));
    }
    return response;
  }

  createTransaction(input: CreateFinanceTransactionInput): Promise<CreateTransactionResponse> {
    const operation = this.#transactionMutation(input);
    return this.#api.request("/api/v1/transactions", {
      method: "POST",
      idempotencyKey: this.#randomUUID(),
      body: operation,
      schema: transactionMutationResultSchema,
    });
  }

  correctTransaction(
    id: UUID,
    input: CreateFinanceTransactionInput,
    reason = "Web arayüzünden düzeltildi",
  ): Promise<CorrectTransactionResponse> {
    return this.#api.request(
      `/api/v1/transactions/${id}/correct?${buildQuery({ bookId: this.bookId() })}`,
      {
        method: "POST",
        idempotencyKey: this.#randomUUID(),
        body: {
          reason,
          reversalClientOperationId: this.#randomUUID(),
          replacement: this.#transactionMutation(input),
        },
        schema: correctTransactionResponseSchema,
      },
    );
  }

  deleteTransaction(
    id: UUID,
    reason = "Web arayüzünden silindi",
  ): Promise<ReverseTransactionResponse> {
    return this.#api.request(
      `/api/v1/transactions/${id}/reverse?${buildQuery({ bookId: this.bookId() })}`,
      {
        method: "POST",
        idempotencyKey: this.#randomUUID(),
        body: { reason, clientOperationId: this.#randomUUID() },
        schema: transactionMutationResultSchema,
      },
    );
  }

  createAccount(input: CreateFinanceAccountInput): Promise<CreateAccountResponse> {
    const { currencyCode = this.#requireBook().baseCurrency, ...values } = input;
    return this.#api.request("/api/v1/accounts", {
      method: "POST",
      body: { bookId: this.bookId(), currencyCode, ...values },
      schema: accountSchema,
    });
  }

  updateAccount(id: UUID, input: UpdateAccountRequest): Promise<UpdateAccountResponse> {
    return this.#api.request(`/api/v1/accounts/${id}`, {
      method: "PATCH",
      body: input,
      schema: accountSchema,
    });
  }

  deleteAccount(id: UUID, version: number): Promise<DeleteAccountResponse> {
    return this.#api.request(`/api/v1/accounts/${id}?${buildQuery({ version })}`, {
      method: "DELETE",
      schema: deleteAccountResponseSchema,
    });
  }

  createCategory(input: CreateFinanceCategoryInput): Promise<CreateCategoryResponse> {
    const { currencyCode = this.#requireBook().baseCurrency, ...values } = input;
    return this.#api.request("/api/v1/categories", {
      method: "POST",
      body: { bookId: this.bookId(), currencyCode, ...values },
      schema: categorySchema,
    });
  }

  updateCategory(id: UUID, input: UpdateCategoryRequest): Promise<UpdateCategoryResponse> {
    return this.#api.request(`/api/v1/categories/${id}`, {
      method: "PATCH",
      body: input,
      schema: categorySchema,
    });
  }

  deleteCategory(id: UUID, version: number): Promise<DeleteCategoryResponse> {
    return this.#api.request(`/api/v1/categories/${id}?${buildQuery({ version })}`, {
      method: "DELETE",
      schema: deleteCategoryResponseSchema,
    });
  }

  createCostCenter(input: CreateFinanceCostCenterInput): Promise<CreateCostCenterResponse> {
    return this.#api.request("/api/v1/cost-centers", {
      method: "POST",
      body: { bookId: this.bookId(), ...input },
      schema: costCenterSchema,
    });
  }

  updateCostCenter(
    id: UUID,
    input: UpdateCostCenterRequest,
  ): Promise<UpdateCostCenterResponse> {
    return this.#api.request(`/api/v1/cost-centers/${id}`, {
      method: "PATCH",
      body: input,
      schema: costCenterSchema,
    });
  }

  deleteCostCenter(id: UUID, version: number): Promise<DeleteCostCenterResponse> {
    return this.#api.request(`/api/v1/cost-centers/${id}?${buildQuery({ version })}`, {
      method: "DELETE",
      schema: deleteCostCenterResponseSchema,
    });
  }

  createScheduled(
    input: CreateFinanceScheduledInput,
  ): Promise<CreateScheduledTransactionResponse> {
    const { currencyCode = this.#requireBook().baseCurrency, ...values } = input;
    return this.#api.request("/api/v1/scheduled-transactions", {
      method: "POST",
      body: { bookId: this.bookId(), currencyCode, ...values },
      schema: createScheduledTransactionResponseSchema,
    });
  }

  updateScheduled(
    id: UUID,
    input: UpdateScheduledTransactionRequest,
  ): Promise<UpdateScheduledTransactionResponse> {
    return this.#api.request(`/api/v1/scheduled-transactions/${id}`, {
      method: "PATCH",
      body: input,
      schema: scheduledTransactionSchema,
    });
  }

  setScheduledStatus(
    id: UUID,
    input: SetScheduledStatusRequest,
  ): Promise<SetScheduledStatusResponse> {
    return this.#api.request(`/api/v1/scheduled-transactions/${id}/status`, {
      method: "PATCH",
      body: input,
      schema: setScheduledStatusResponseSchema,
    });
  }

  deleteScheduled(id: UUID, version: number): Promise<DeleteScheduledTransactionResponse> {
    return this.#api.request(
      `/api/v1/scheduled-transactions/${id}?${buildQuery({ version })}`,
      { method: "DELETE", schema: deleteScheduledTransactionResponseSchema },
    );
  }

  realizeScheduled(
    id: UUID,
    version: number,
    transactionDate = this.#now().toISOString(),
  ): Promise<RealizeScheduledTransactionResponse> {
    return this.#api.request(`/api/v1/scheduled-transactions/${id}/realize`, {
      method: "POST",
      body: { version, transactionDate, clientOperationId: this.#randomUUID() },
      schema: realizeScheduledTransactionResponseSchema,
    });
  }

  createAssetType(
    input: CreateFinanceAssetTypeInput,
  ): Promise<CreateInvestmentAssetTypeResponse> {
    return this.#api.request("/api/v1/investments/asset-types", {
      method: "POST",
      body: { bookId: this.bookId(), ...input },
      schema: investmentAssetTypeSchema,
    });
  }

  updateAssetType(
    id: UUID,
    input: UpdateInvestmentAssetTypeRequest,
  ): Promise<UpdateInvestmentAssetTypeResponse> {
    return this.#api.request(`/api/v1/investments/asset-types/${id}`, {
      method: "PATCH",
      body: input,
      schema: investmentAssetTypeSchema,
    });
  }

  deleteAssetType(
    id: UUID,
    version: number,
  ): Promise<DeleteInvestmentAssetTypeResponse> {
    return this.#api.request(
      `/api/v1/investments/asset-types/${id}?${buildQuery({ version })}`,
      { method: "DELETE", schema: deleteInvestmentAssetTypeResponseSchema },
    );
  }

  createInstrument(
    input: CreateFinanceInstrumentInput,
  ): Promise<CreateInvestmentInstrumentResponse> {
    const { currencyCode = this.#requireBook().baseCurrency, ...values } = input;
    return this.#api.request("/api/v1/investments/instruments", {
      method: "POST",
      body: { bookId: this.bookId(), currencyCode, ...values },
      schema: investmentInstrumentSchema,
    });
  }

  updateInstrument(
    id: UUID,
    input: UpdateInvestmentInstrumentRequest,
  ): Promise<UpdateInvestmentInstrumentResponse> {
    return this.#api.request(`/api/v1/investments/instruments/${id}`, {
      method: "PATCH",
      body: input,
      schema: investmentInstrumentSchema,
    });
  }

  deleteInstrument(
    id: UUID,
    version: number,
  ): Promise<DeleteInvestmentInstrumentResponse> {
    return this.#api.request(
      `/api/v1/investments/instruments/${id}?${buildQuery({ version })}`,
      { method: "DELETE", schema: deleteInvestmentInstrumentResponseSchema },
    );
  }

  setPrice(id: UUID, input: SetInvestmentPriceRequest): Promise<InvestmentPriceDTO> {
    return this.#api.request(`/api/v1/investments/instruments/${id}/prices`, {
      method: "POST",
      body: input,
      schema: investmentPriceSchema,
    });
  }

  searchMarketSymbols(query: string, market?: "BIST" | "US"): Promise<MarketSymbolListResponse> {
    return this.#api.request(`/api/v1/investments/market-symbols?${buildQuery({
      q: query,
      market,
      limit: 40,
    })}`, { schema: marketSymbolListSchema });
  }

  instrumentPricesAtDate(date: string): Promise<InvestmentPricesAtDateResponse> {
    return this.#api.request(`/api/v1/investments/prices/by-date?${buildQuery({
      bookId: this.bookId(),date,
    })}`, { schema: investmentPricesAtDateSchema });
  }

  syncMarketPrices(date: string): Promise<MarketPriceSyncRunDTO> {
    return this.#api.request("/api/v1/investments/prices/sync", {
      method: "POST",
      body: {bookId:this.bookId(),date},
      schema: marketPriceSyncRunSchema,
    });
  }

  async marketPriceSyncStatus(date: string): Promise<MarketPriceSyncRunDTO | null> {
    const response=await this.#api.request(`/api/v1/investments/prices/sync-status?${buildQuery({
      bookId:this.bookId(),date,
    })}`, { schema: marketPriceSyncStatusSchema });
    return response.run;
  }

  listCurrencies(): Promise<CurrencyListResponse> {
    return this.#api.request(`/api/v1/currencies?${buildQuery({ bookId: this.bookId() })}`, {
      schema: currencyListSchema,
    });
  }

  enableCurrency(code: string): Promise<EnableCurrencyResponse> {
    return this.#api.request(`/api/v1/currencies/${code}/enable`, {
      method: "POST",
      body: { bookId: this.bookId() },
      schema: enableCurrencyResponseSchema,
    });
  }

  disableCurrency(code: string): Promise<DisableCurrencyResponse> {
    return this.#api.request(
      `/api/v1/currencies/${code}/enable?${buildQuery({ bookId: this.bookId() })}`,
      { method: "DELETE", schema: disableCurrencyResponseSchema },
    );
  }

  currencyRatesAtDate(date: string): Promise<CurrencyRatesAtDateResponse> {
    return this.#api.request(`/api/v1/currencies/rates/by-date?${buildQuery({
      bookId: this.bookId(),date,
    })}`, { schema: currencyRatesAtDateSchema });
  }

  syncCurrencyRates(date: string): Promise<CurrencyRateSyncRunDTO> {
    return this.#api.request("/api/v1/currencies/rates/sync", {
      method: "POST",
      body: { bookId: this.bookId(), date },
      schema: currencyRateSyncRunSchema,
    });
  }

  async currencyRateSyncStatus(date: string): Promise<CurrencyRateSyncRunDTO | null> {
    const response = await this.#api.request(`/api/v1/currencies/rates/sync-status?${buildQuery({
      bookId: this.bookId(),date,
    })}`, {
      schema: currencyRateSyncStatusSchema,
    });
    return response.run;
  }

  createLot(input: CreateFinanceLotInput): Promise<CreateInvestmentLotResponse> {
    return this.#api.request("/api/v1/investments/lots", {
      method: "POST",
      body: { bookId: this.bookId(), ...input },
      schema: investmentLotSchema,
    });
  }

  updateLot(id: UUID, input: UpdateInvestmentLotRequest): Promise<UpdateInvestmentLotResponse> {
    return this.#api.request(`/api/v1/investments/lots/${id}`, {
      method: "PATCH",
      body: input,
      schema: investmentLotSchema,
    });
  }

  deleteLot(id: UUID, version: number): Promise<DeleteInvestmentLotResponse> {
    return this.#api.request(
      `/api/v1/investments/lots/${id}?${buildQuery({ version })}`,
      { method: "DELETE", schema: deleteInvestmentLotResponseSchema },
    );
  }

  createSale(input: CreateFinanceSaleInput): Promise<CreateInvestmentSaleResponse> {
    return this.#api.request("/api/v1/investments/sales", {
      method: "POST",
      body: { bookId: this.bookId(), clientOperationId: this.#randomUUID(), ...input },
      schema: investmentSaleSchema,
    });
  }

  updateSale(id: UUID, input: UpdateFinanceSaleInput): Promise<UpdateInvestmentSaleResponse> {
    return this.#api.request(`/api/v1/investments/sales/${id}`, {
      method: "PATCH",
      body: {
        clientOperationId: this.#randomUUID(),
        reversalClientOperationId: this.#randomUUID(),
        ...input,
      },
      schema: investmentSaleSchema,
    });
  }

  deleteSale(id: UUID, version: number): Promise<DeleteInvestmentSaleResponse> {
    return this.#api.request(
      `/api/v1/investments/sales/${id}?${buildQuery({ version })}`,
      { method: "DELETE", schema: deleteInvestmentSaleResponseSchema },
    );
  }

  #transactionMutation(input: CreateFinanceTransactionInput): CreateTransactionRequest {
    const { currencyCode = this.#requireBook().baseCurrency, ...values } = input;
    return {
      bookId: this.bookId(),
      currencyCode,
      clientOperationId: this.#randomUUID(),
      ...values,
    };
  }

  #reportQuery(range: ReportRange): string {
    return buildQuery({
      bookId: this.bookId(),
      from: range.from ? startOfDayBoundary(range.from) : undefined,
      to: range.to ? endOfDayBoundary(range.to) : undefined,
      accountIds: serializeCashFlowAccountIds(range.accountIds),
      granularity: range.granularity,
      _: this.#now().getTime(),
    });
  }

  #transactionPatch(
    response: TransactionListResponse,
    filter: TransactionFilter,
  ): Pick<
    FinanceSnapshot,
    | "transactions"
    | "transactionOpeningBalance"
    | "transactionOpeningBalanceValue"
    | "transactionNextCursor"
    | "transactionFilter"
  > {
    return {
      transactions: response.items.map(transactionView),
      transactionOpeningBalance: response.openingBalance,
      transactionOpeningBalanceValue: toUiNumber(response.openingBalance),
      transactionNextCursor: response.nextCursor,
      transactionFilter: filter,
    };
  }

  #nextCashFlowAccountIds(accounts: FinanceSnapshot["accounts"]): readonly UUID[] {
    const previousActiveIds = this.#state.accounts
      .filter((account) => !account.isArchived)
      .map((account) => account.id);
    const allWereSelected =
      this.#state.cashflowAccountsInitialized &&
      previousActiveIds.every((id) => this.#state.cashflowAccountIds.includes(id));
    const activeIds = accounts.filter((account) => !account.isArchived).map((account) => account.id);
    if (!this.#state.cashflowAccountsInitialized || allWereSelected) return activeIds;
    const activeSet = new Set(activeIds);
    return this.#state.cashflowAccountIds.filter((id) => activeSet.has(id));
  }

  #requireBook(): BookListItemDTO {
    if (!this.#state.book) throw new FinanceStateError("BOOK_REQUIRED");
    return this.#state.book;
  }

  #commit(updater: SnapshotUpdater): void {
    this.#replace(updater(this.#state));
  }

  #replace(snapshot: FinanceSnapshot): void {
    if (snapshot === this.#state) return;
    this.#state = snapshot;
    for (const listener of this.#listeners) listener();
  }
}
