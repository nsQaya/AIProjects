import type { TransactionListItemDTO } from "@defterx/contracts";
import { transactionDisplayTitle, transactionView } from "./finance-views";

const TRANSACTION_ID = "00000000-0000-4000-8000-000000000001";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000002";

function transactionFixture(
  overrides: Partial<TransactionListItemDTO> = {},
): TransactionListItemDTO {
  return {
    id: TRANSACTION_ID,
    transactionNo: "1",
    type: "EXPENSE",
    accountId: ACCOUNT_ID,
    accountName: "Banka",
    targetAccountId: null,
    targetAccountName: null,
    title: "Market",
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
    amount: "250.00",
    balanceDelta: "-250.00",
    runningBalance: "750.00",
    ...overrides,
  };
}

describe("transaction display title", () => {
  it("uses the canonical title for a normal transaction with supporting description", () => {
    const view = transactionView(
      transactionFixture({ title: "Market alışverişi", description: "Haftalık ihtiyaçlar" }),
    );

    expect(view.ui.description).toBe("Market alışverişi");
  });

  it("uses the reversal title instead of the reversal reason", () => {
    expect(
      transactionDisplayTitle({
        title: "İptal: Market alışverişi",
        description: "Yanlış hesaptan girildi",
      }),
    ).toBe("İptal: Market alışverişi");
  });

  it("keeps a realized scheduled item's title instead of its provenance description", () => {
    const view = transactionView(
      transactionFixture({
        title: "Kredi taksidi",
        description: "Yaklaşan işlemden gerçekleşti olarak aktarıldı",
      }),
    );

    expect(view.ui.description).toBe("Kredi taksidi");
  });
});
