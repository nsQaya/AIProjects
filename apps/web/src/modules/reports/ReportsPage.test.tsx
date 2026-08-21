import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { IncomeExpenseCostCenterItemDTO, ReportAnalyticsResponse } from "@defterx/contracts";
import { describe, expect, it } from "vitest";

import type { AccountView } from "../../finance";
import { ReportsPage, type ReportCategoryItem } from "./ReportsPage";

vi.mock("../../components/charts", () => ({
  ReportChart: ({ label }: { label: string }) => (
    <div data-report-chart role="img" aria-label={label} />
  ),
}));

const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const TRANSACTION_ONE_ID = "00000000-0000-4000-8000-000000000004";
const TRANSACTION_TWO_ID = "00000000-0000-4000-8000-000000000005";
const INSTRUMENT_ID = "00000000-0000-4000-8000-000000000006";

function reportAccount(id: string, name: string): AccountView {
  return {
    id,
    bookId: "00000000-0000-4000-8000-000000000010",
    contactId: null,
    name,
    accountTypeId: "00000000-0000-4000-8000-000000000099",
    accountTypeName: "Banka",
    accountTypeIcon: null,
    normalBalance: "DEBIT",
    currencyCode: "TRY",
    allowNegativeBalance: false,
    creditLimit: null,
    isArchived: false,
    sortOrder: 0,
    version: 1,
    balance: "0",
    displayBalance: "0",
    availableCredit: null,
    ui: {
      balance: 0,
      displayBalance: 0,
      creditLimit: null,
      availableCredit: null,
    },
  };
}

function analyticsFixture(): ReportAnalyticsResponse {
  const categoryId = "00000000-0000-4000-8000-000000000020";
  const costCenterId = "00000000-0000-4000-8000-000000000021";
  return {
    from: "2026-08-01T00:00:00.000Z",
    to: "2026-08-31T23:59:59.999Z",
    granularity: "month",
    currencyCode: "TRY",
    trend: [{ period: "2026-08", month: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", income: "1000", expense: "400", net: "600", balance: "1600" }],
    accountBalances: {
      accounts: [{ id: ACCOUNT_ID, name: "Banka", currencyCode: "TRY" }],
      items: [{ period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", accountId: ACCOUNT_ID, balance: "1600" }],
    },
    categoryDetail: {
      breakdown: [{ categoryId, categoryName: "Market", categoryType: "EXPENSE", costCenterId, costCenterName: "Ev", amount: "400" }],
      transactions: [{ id: TRANSACTION_ONE_ID, type: "EXPENSE", title: "Haftalık alışveriş", transactionDate: "2026-08-12T10:00:00.000Z", categoryId, categoryName: "Market", costCenterId, costCenterName: "Ev", accountName: "Banka", currencyCode: "TRY", amount: "400" }],
    },
    liquidity: {
      openingBalance: "1600",
      items: [{ period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", inflow: "500", outflow: "200", net: "300", projectedBalance: "1900" }],
      events: [{ id: TRANSACTION_TWO_ID, title: "Beklenen ödeme", scheduledAt: "2026-08-20T10:00:00.000Z", type: "EXPENSE", impact: "-200" }],
    },
    investmentValueSeries: [{ period: "2026-08", periodStart: "2026-08-01T00:00:00.000Z", value: "1200" }],
    netWorth: {
      cashBalance: "1600", investmentCost: "1000", investmentValue: "1200", realizedGain: "50", unrealizedGain: "200", totalAssets: "2800",
      items: [{ instrumentId: INSTRUMENT_ID, name: "Fon", symbol: "FON", assetTypeName: "Yatırım Fonu", currencyCode: "TRY", quantity: "10", costBasis: "1000", currentValue: "1200", realizedGain: "50", unrealizedGain: "200", latestPriceAt: "2026-08-14T10:00:00.000Z", currentValueTRY: "1200", unrealizedGainTRY: "200", costBasisTRY: "1000", realizedGainTRY: "50" }],
    },
  };
}

describe("ReportsPage", () => {
  it("contains a report failure without hiding the rest of the application", () => {
    render(<ReportsPage loadFailed />);
    expect(screen.getByText(/Rapor verileri yüklenemedi/)).toBeInTheDocument();
  });

  it("retains inactive categories that have historical expense amounts", () => {
    const items: ReportCategoryItem[] = [
      {
        id: "active-expense",
        name: "Market",
        type: "EXPENSE",
        isActive: true,
        amount: "2500.00",
      },
      {
        id: "inactive-expense",
        name: "Eski kategori",
        type: "EXPENSE",
        isActive: false,
        amount: "750.00",
      },
      {
        id: "income",
        name: "Maaş",
        type: "INCOME",
        isActive: true,
        amount: "10000.00",
      },
    ];

    render(<ReportsPage costCenters={[]} items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "Kategori detayı" }));

    expect(screen.getByText("Market")).toBeInTheDocument();
    expect(screen.getByText("Eski kategori (pasif)")).toBeInTheDocument();
    expect(
      document.querySelector('[data-report-category="inactive-expense"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText("Maaş")).not.toBeInTheDocument();
  });

  it("renders category names as text instead of interpreting stored markup", () => {
    render(
      <ReportsPage
        costCenters={[]}
        items={[
          {
            id: "escaped",
            name: '<img src=x onerror="alert(1)">',
            type: "EXPENSE",
            isActive: true,
            amount: "1.00",
          },
        ]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Kategori detayı" }));

    expect(screen.getByText('<img src=x onerror="alert(1)">')).toBeInTheDocument();
    expect(document.querySelector("img")).toBeNull();
  });

  it("shows negative expense allocation and preserves inactive historical cost centers", () => {
    const costCenters: IncomeExpenseCostCenterItemDTO[] = [
      {
        id: "active-car",
        name: "Aile arabası",
        isActive: true,
        amount: "-900.00",
      },
      {
        id: "inactive-car",
        name: "Eski araç",
        isActive: false,
        amount: "-300.00",
      },
      {
        id: "positive-net",
        name: "Gelir tarafı",
        isActive: true,
        amount: "250.00",
      },
    ];

    render(<ReportsPage costCenters={costCenters} items={[]} />);
    fireEvent.click(screen.getByRole("button", { name: "Kategori detayı" }));

    const activeRow = document.querySelector<HTMLElement>(
      '[data-report-cost-center="active-car"]',
    );
    const inactiveRow = document.querySelector<HTMLElement>(
      '[data-report-cost-center="inactive-car"]',
    );
    expect(activeRow).not.toBeNull();
    expect(inactiveRow).not.toBeNull();
    expect(within(activeRow!).getByText("Aile arabası")).toBeInTheDocument();
    expect(within(inactiveRow!).getByText("Eski araç (pasif)")).toBeInTheDocument();
    expect(
      document.querySelector('[data-report-cost-center="positive-net"]'),
    ).toBeNull();
    expect(screen.queryByText("Gelir tarafı")).not.toBeInTheDocument();
  });

  it("applies date and account selections through the shared report filter", async () => {
    const user = userEvent.setup();
    const bank = reportAccount("00000000-0000-4000-8000-000000000001", "Banka");
    const cash = reportAccount("00000000-0000-4000-8000-000000000002", "Nakit");
    const onFilterChange = vi.fn().mockResolvedValue(undefined);

    render(
      <ReportsPage
        accounts={[bank, cash]}
        costCenters={[]}
        items={[]}
        range={{ from: "2026-08-01", to: "2026-08-14" }}
        onFilterChange={onFilterChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Başlangıç"), {
      target: { value: "2026-07-01" },
    });
    await user.click(screen.getByRole("checkbox", { name: "Banka" }));
    await user.click(screen.getByRole("button", { name: "Raporu uygula" }));

    await waitFor(() => {
      expect(onFilterChange).toHaveBeenCalledWith({
        from: "2026-07-01",
        to: "2026-08-14",
        accountIds: [cash.id],
        granularity: "month",
      });
    });
  });

  it("navigates all five analytics reports and exposes transaction drill-down", async () => {
    const user = userEvent.setup();
    render(<ReportsPage analytics={analyticsFixture()} />);

    expect(screen.getByRole("heading", { name: "Gelir–Gider–Net Trendi" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Hesap bakiyeleri" }));
    expect(screen.getByRole("heading", { name: "Hesap Bakiyesi Gelişimi" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Kategori detayı" }));
    expect(screen.getByText("Haftalık alışveriş")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Likidite tahmini" }));
    expect(screen.getByText("Beklenen ödeme")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Varlık ve yatırım" }));
    expect(screen.getByText("Fon")).toBeInTheDocument();
  });
});
