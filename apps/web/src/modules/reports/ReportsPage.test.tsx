import { render, screen, within } from "@testing-library/react";
import type { IncomeExpenseCostCenterItemDTO } from "@defterx/contracts";
import { describe, expect, it } from "vitest";

import { ReportsPage, type ReportCategoryItem } from "./ReportsPage";

describe("ReportsPage", () => {
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
});
