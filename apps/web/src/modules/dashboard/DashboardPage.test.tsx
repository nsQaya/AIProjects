import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type { CashFlowRange, CashFlowVisibility } from "../../finance";
import { emptyDashboard } from "../../finance/finance-state";
import type { AccountView, CashFlowView } from "../../finance/finance-views";
import { money } from "../../lib/format";
import { CashFlowChart, DashboardPage, type DashboardSnapshot } from ".";

const ACCOUNT_ONE = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_TWO = "00000000-0000-4000-8000-000000000002";

const accounts: readonly AccountView[] = [
  {
    id: ACCOUNT_ONE,
    bookId: "00000000-0000-4000-8000-000000000010",
    contactId: null,
    name: "Banka",
    accountType: "BANK",
    normalBalance: "DEBIT",
    currencyCode: "TRY",
    allowNegativeBalance: false,
    creditLimit: null,
    isArchived: false,
    sortOrder: 0,
    version: 1,
    balance: "1200",
    displayBalance: "1200",
    availableCredit: null,
    ui: {
      balance: 1200,
      displayBalance: 1200,
      creditLimit: null,
      availableCredit: null,
    },
  },
  {
    id: ACCOUNT_TWO,
    bookId: "00000000-0000-4000-8000-000000000010",
    contactId: null,
    name: "Nakit",
    accountType: "CASH",
    normalBalance: "DEBIT",
    currencyCode: "TRY",
    allowNegativeBalance: false,
    creditLimit: null,
    isArchived: false,
    sortOrder: 1,
    version: 1,
    balance: "300",
    displayBalance: "300",
    availableCredit: null,
    ui: {
      balance: 300,
      displayBalance: 300,
      creditLimit: null,
      availableCredit: null,
    },
  },
];

const cashflow: readonly CashFlowView[] = [
  {
    period: "2026-07",
    month: "2026-07",
    periodStart: "2026-07-01T00:00:00.000Z",
    income: "0",
    expense: "0",
    net: "0",
    balance: "1000",
    ui: { label: "Tem", income: 0, expense: 0, net: 0, balance: 1000 },
  },
  {
    period: "2026-08",
    month: "2026-08",
    periodStart: "2026-08-01T00:00:00.000Z",
    income: "500",
    expense: "200",
    net: "300",
    balance: "1300",
    ui: { label: "Ağu", income: 500, expense: 200, net: 300, balance: 1300 },
  },
];

const visibility = { income: true, expense: true, balance: true } as const;

function snapshot(): DashboardSnapshot {
  return {
    accounts,
    categories: [],
    transactions: [],
    upcoming: [],
    dashboard: {
      ...emptyDashboard,
      month: { income: "500", expense: "200" },
      ui: { income: 500, expense: 200 },
    },
    cashflow,
    cashflowRange: "6M",
    cashflowVisible: visibility,
    cashflowAccountIds: [ACCOUNT_ONE, ACCOUNT_TWO],
  };
}

function dayAtOffset(offset: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

function recentTransaction(id: string, title: string, dayOffset: number, amount: string) {
  const date = dayAtOffset(dayOffset);
  return {
    id,
    type: "EXPENSE" as const,
    title,
    transactionDate: `${date}T12:00:00.000Z`,
    currencyCode: "TRY" as const,
    amount,
    ui: { amount: Number(amount), date },
  };
}

function upcomingTransaction(
  id: string,
  title: string,
  dayOffset: number,
  transactionType: "INCOME" | "EXPENSE",
  amount: string,
): DashboardSnapshot["upcoming"][number] {
  const date = dayAtOffset(dayOffset);
  return {
    id,
    bookId: "00000000-0000-4000-8000-000000000010",
    accountId: ACCOUNT_ONE,
    targetAccountId: null,
    transactionType,
    categoryId: null,
    costCenterId: null,
    costCenterName: null,
    contactId: null,
    title,
    amount,
    currencyCode: "TRY",
    scheduledAt: `${date}T12:00:00.000Z`,
    reminderAt: null,
    status: "PENDING",
    seriesId: null,
    recurrenceFrequency: null,
    recurrenceInterval: null,
    recurrenceEndAt: null,
    completedTransactionId: null,
    version: 1,
    ui: {
      kind: transactionType.toLowerCase() as "income" | "expense",
      date,
      amount: Number(amount),
      categoryName: "",
      costCenterName: "",
    },
  };
}

function pageCallbacks() {
  const onCashflowRangeChange = vi.fn<(range: CashFlowRange) => Promise<unknown>>();
  const onCashflowAccountsChange = vi.fn<(accountIds: readonly string[]) => Promise<unknown>>();
  const onCashflowVisibilityChange = vi.fn<
    (patch: Partial<CashFlowVisibility>) => void
  >();
  onCashflowRangeChange.mockResolvedValue(undefined);
  onCashflowAccountsChange.mockResolvedValue(undefined);
  return {
    onCashflowRangeChange,
    onCashflowAccountsChange,
    onCashflowVisibilityChange,
  };
}

describe("DashboardPage", () => {
  it("uses user-facing account balances for the live net balance", () => {
    const creditCard: AccountView = {
      ...accounts[0]!,
      id: "00000000-0000-4000-8000-000000000003",
      name: "Kredi kartı",
      accountType: "CREDIT_CARD",
      normalBalance: "CREDIT",
      balance: "500",
      displayBalance: "-500",
      ui: {
        balance: 500,
        displayBalance: -500,
        creditLimit: null,
        availableCredit: null,
      },
    };
    const data = snapshot();
    const { container } = render(
      <DashboardPage
        snapshot={{ ...data, accounts: [...data.accounts, creditCard] }}
        {...pageCallbacks()}
      />,
    );

    expect(container.querySelector(".hero-copy strong")).toHaveTextContent(money(1000));
  });

  it("exposes every requested range and loads a newly selected range", async () => {
    const user = userEvent.setup();
    const callbacks = pageCallbacks();
    render(<DashboardPage snapshot={snapshot()} {...callbacks} />);

    const rangeSwitch = within(
      screen.getByRole("group", { name: "Nakit akışı tarih aralığı" }),
    );

    for (const label of ["1 ay", "3 ay", "6 ay", "Yıl başı", "1 yıl", "5 yıl", "10 yıl"]) {
      expect(rangeSwitch.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(rangeSwitch.getByRole("button", { name: "6 ay" })).toHaveAttribute("aria-pressed", "true");

    await user.click(rangeSwitch.getByRole("button", { name: "1 ay" }));
    await user.click(rangeSwitch.getByRole("button", { name: "3 ay" }));
    await user.click(rangeSwitch.getByRole("button", { name: "Yıl başı" }));
    await user.click(rangeSwitch.getByRole("button", { name: "1 yıl" }));
    await user.click(rangeSwitch.getByRole("button", { name: "5 yıl" }));
    await user.click(rangeSwitch.getByRole("button", { name: "10 yıl" }));

    expect(callbacks.onCashflowRangeChange.mock.calls.map(([range]) => range)).toEqual([
      "1M",
      "3M",
      "YTD",
      "1Y",
      "5Y",
      "10Y",
    ]);
  });

  it("filters upcoming and recent cards independently and recalculates expected net", async () => {
    const user = userEvent.setup();
    const data = snapshot();
    const callbacks = pageCallbacks();
    data.upcoming = [
      upcomingTransaction(
        "00000000-0000-4000-8000-000000000020",
        "Yakın gelir",
        10,
        "INCOME",
        "100",
      ),
      upcomingTransaction(
        "00000000-0000-4000-8000-000000000021",
        "Uzak gider",
        45,
        "EXPENSE",
        "30",
      ),
    ];
    data.dashboard = {
      ...data.dashboard,
      recentTransactions: [
        recentTransaction(
          "00000000-0000-4000-8000-000000000030",
          "Yakın işlem",
          -10,
          "20",
        ),
        recentTransaction(
          "00000000-0000-4000-8000-000000000031",
          "Eski işlem",
          -45,
          "40",
        ),
      ],
    };

    const { container } = render(
      <DashboardPage snapshot={data} {...callbacks} />,
    );
    const upcomingRanges = within(
      screen.getByRole("group", { name: "Yaklaşan tarih aralığı" }),
    );
    const recentRanges = within(
      screen.getByRole("group", { name: "Son işlemler tarih aralığı" }),
    );

    for (const label of ["1 ay", "3 ay", "6 ay", "Yıl başı", "1 yıl", "5 yıl", "10 yıl"]) {
      expect(upcomingRanges.getByRole("button", { name: label })).toBeInTheDocument();
      expect(recentRanges.getByRole("button", { name: label })).toBeInTheDocument();
    }
    expect(screen.getByText("Yakın gelir")).toBeInTheDocument();
    expect(screen.queryByText("Uzak gider")).not.toBeInTheDocument();
    expect(screen.getByText("Yakın işlem")).toBeInTheDocument();
    expect(screen.queryByText("Eski işlem")).not.toBeInTheDocument();
    expect(container.querySelector(".upcoming-total strong")).toHaveTextContent(money(100));

    await user.click(upcomingRanges.getByRole("button", { name: "3 ay" }));

    expect(screen.getByText("Uzak gider")).toBeInTheDocument();
    expect(screen.queryByText("Eski işlem")).not.toBeInTheDocument();
    expect(container.querySelector(".upcoming-total strong")).toHaveTextContent(money(70));

    await user.click(recentRanges.getByRole("button", { name: "3 ay" }));

    expect(screen.getByText("Eski işlem")).toBeInTheDocument();
    expect(callbacks.onCashflowRangeChange).not.toHaveBeenCalled();
  });

  it("renders an async cash-flow failure inside the panel", async () => {
    const user = userEvent.setup();
    const callbacks = pageCallbacks();
    callbacks.onCashflowRangeChange.mockRejectedValueOnce(new Error("Aralık yüklenemedi."));
    render(<DashboardPage snapshot={snapshot()} {...callbacks} />);

    await user.click(within(
      screen.getByRole("group", { name: "Nakit akışı tarih aralığı" }),
    ).getByRole("button", { name: "1 ay" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Aralık yüklenemedi.");
  });

  it("keeps rapid account filter intent while server requests are still pending", async () => {
    const user = userEvent.setup();
    const callbacks = pageCallbacks();
    const releases: Array<() => void> = [];
    callbacks.onCashflowAccountsChange.mockImplementation(
      () => new Promise<void>((resolve) => releases.push(resolve)),
    );
    render(<DashboardPage snapshot={snapshot()} {...callbacks} />);

    await user.click(screen.getByRole("checkbox", { name: "Banka" }));
    await user.click(screen.getByRole("checkbox", { name: "Nakit" }));

    expect(callbacks.onCashflowAccountsChange.mock.calls.map(([ids]) => ids)).toEqual([
      [ACCOUNT_TWO],
      [],
    ]);

    await act(async () => {
      releases.forEach((release) => release());
      await Promise.resolve();
    });
  });
});

describe("CashFlowChart", () => {
  it("reports series and account checkbox changes without mutating its inputs", async () => {
    const user = userEvent.setup();
    const onAccountsChange = vi.fn();
    const onVisibilityChange = vi.fn();
    const { rerender } = render(
      <CashFlowChart
        accounts={accounts}
        accountIds={[ACCOUNT_ONE, ACCOUNT_TWO]}
        items={cashflow}
        visibility={visibility}
        onAccountsChange={onAccountsChange}
        onVisibilityChange={onVisibilityChange}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: "Gelir" }));
    expect(onVisibilityChange).toHaveBeenCalledWith({ income: false });

    await user.click(screen.getByRole("checkbox", { name: "Banka" }));
    expect(onAccountsChange).toHaveBeenLastCalledWith([ACCOUNT_TWO]);

    await user.click(screen.getByRole("checkbox", { name: "Tüm hesaplar" }));
    expect(onAccountsChange).toHaveBeenLastCalledWith([]);

    rerender(
      <CashFlowChart
        accounts={accounts}
        accountIds={[ACCOUNT_ONE, ACCOUNT_TWO]}
        items={cashflow}
        visibility={{ ...visibility, balance: false }}
        onAccountsChange={onAccountsChange}
        onVisibilityChange={onVisibilityChange}
      />,
    );
    expect(screen.queryByText("Bakiyeye dahil hesaplar")).not.toBeInTheDocument();
  });

  it("suppresses zero columns while retaining the server-authored balance line", () => {
    const { container } = render(
      <CashFlowChart
        accounts={accounts}
        accountIds={[ACCOUNT_ONE, ACCOUNT_TWO]}
        items={cashflow}
        visibility={visibility}
        onAccountsChange={vi.fn()}
        onVisibilityChange={vi.fn()}
      />,
    );

    expect(container.querySelector('[data-cashflow-bar="income"][data-cashflow-bar-index="0"]')).toBeNull();
    expect(container.querySelector('[data-cashflow-bar="expense"][data-cashflow-bar-index="0"]')).toBeNull();
    expect(container.querySelectorAll('[data-cashflow-bar="income"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-cashflow-bar="expense"]')).toHaveLength(1);
    expect(container.querySelector(".balance-line")).toBeInTheDocument();
  });

  it("keeps its absolutely positioned tooltip stable while the pointer moves", () => {
    const { container } = render(
      <CashFlowChart
        accounts={accounts}
        accountIds={[ACCOUNT_ONE, ACCOUNT_TWO]}
        items={cashflow}
        visibility={visibility}
        onAccountsChange={vi.fn()}
        onVisibilityChange={vi.fn()}
      />,
    );
    const visual = container.querySelector(".cashflow-visual");
    const hit = container.querySelector('.chart-hit[data-cashflow-index="1"]');
    const tooltip = container.querySelector("#cashflow-tooltip");
    expect(visual).not.toBeNull();
    expect(hit).not.toBeNull();
    expect(tooltip).not.toBeNull();

    fireEvent.mouseEnter(hit!);
    expect(tooltip).not.toHaveAttribute("hidden");
    expect(tooltip).toHaveTextContent("Ağu");
    const position = (tooltip as HTMLElement).style.left;
    expect(position).toContain("clamp(");

    fireEvent.pointerMove(hit!, { clientX: 10 });
    fireEvent.pointerMove(hit!, { clientX: 800 });
    expect((tooltip as HTMLElement).style.left).toBe(position);

    fireEvent.mouseLeave(visual!);
    expect(tooltip).toHaveAttribute("hidden");
  });
});
