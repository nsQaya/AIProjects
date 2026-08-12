import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CategoryDTO, CostCenterDTO } from "@defterx/contracts";
import { describe, expect, it, vi } from "vitest";

import { SettingsPage } from "./SettingsPage";
import type { SettingsActions, SettingsViewModel } from "./settings-types";

const category: CategoryDTO = {
  id: "category-1",
  bookId: "book-1",
  parentId: null,
  name: "Market",
  categoryType: "EXPENSE",
  icon: null,
  sortOrder: 10,
  isSystem: false,
  isActive: true,
  version: 3,
};

const activeCostCenter: CostCenterDTO = {
  id: "cost-center-1",
  bookId: "book-1",
  name: "Aile arabası",
  description: "Yakıt ve bakım",
  sortOrder: 10,
  isActive: true,
  version: 3,
};

const inactiveCostCenter: CostCenterDTO = {
  ...activeCostCenter,
  id: "cost-center-2",
  name: "Eski araç",
  description: null,
  isActive: false,
  version: 5,
};

function settingsModel(
  categories: readonly CategoryDTO[] = [category],
  costCenters: readonly CostCenterDTO[] = [],
): SettingsViewModel {
  return {
    apiBaseUrl: "https://api.example.test",
    apiStatus: { online: true, reason: "Canlı API yanıt veriyor." },
    book: { name: "Kişisel Defter", baseCurrency: "TRY" },
    categories,
    costCenters,
    instruments: [],
    investmentTypes: [],
    user: { displayName: "Nihat Kaya", email: "nihat@example.test" },
  };
}

function settingsActions(overrides: Partial<SettingsActions> = {}): SettingsActions {
  return {
    onActivateCategory: vi.fn(() => Promise.resolve()),
    onActivateCostCenter: vi.fn(() => Promise.resolve()),
    onActivateInstrument: vi.fn(() => Promise.resolve()),
    onActivateInvestmentType: vi.fn(() => Promise.resolve()),
    onDeleteCategory: vi.fn(() => Promise.resolve()),
    onDeleteCostCenter: vi.fn(() => Promise.resolve()),
    onDeleteInstrument: vi.fn(() => Promise.resolve()),
    onDeleteInvestmentType: vi.fn(() => Promise.resolve()),
    onLogout: vi.fn(() => Promise.resolve()),
    onChangePassword: vi.fn(() => Promise.resolve()),
    onSaveCategory: vi.fn(() => Promise.resolve()),
    onSaveCostCenter: vi.fn(() => Promise.resolve()),
    onSaveInstrument: vi.fn(() => Promise.resolve()),
    onSaveInstrumentPrice: vi.fn(() => Promise.resolve()),
    onSaveInvestmentType: vi.fn(() => Promise.resolve()),
    ...overrides,
  };
}

describe("SettingsPage category management", () => {
  it("changes the password from the profile security dialog", async () => {
    const user = userEvent.setup();
    const onChangePassword = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onChangePassword })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Şifreyi değiştir" }));
    const dialog = screen.getByRole("dialog", { name: "Şifreyi değiştir" });
    await user.type(screen.getByLabelText("Mevcut şifre"), "EskiGucluSifre123!");
    await user.type(screen.getByLabelText("Yeni şifre"), "YeniGucluSifre123!");
    await user.type(screen.getByLabelText("Yeni şifre tekrarı"), "YeniGucluSifre123!");
    await user.click(screen.getByRole("button", { name: "Şifreyi güncelle" }));

    await waitFor(() =>
      expect(onChangePassword).toHaveBeenCalledWith({
        currentPassword: "EskiGucluSifre123!",
        newPassword: "YeniGucluSifre123!",
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("creates a category and closes only after the callback succeeds", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Kategori" }));
    const dialog = screen.getByRole("dialog", { name: "Kategori" });
    await user.type(screen.getByLabelText("Ad"), "Maaş");
    await user.selectOptions(screen.getByLabelText("Tür"), "INCOME");
    await user.clear(screen.getByLabelText("Sıra"));
    await user.type(screen.getByLabelText("Sıra"), "20");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() =>
      expect(onSaveCategory).toHaveBeenCalledWith({
        mode: "create",
        categoryType: "INCOME",
        name: "Maaş",
        sortOrder: 20,
      }),
    );
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("edits name and order while keeping the established category type immutable", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Düzenle" }));
    expect(screen.getByLabelText("Tür")).toBeDisabled();
    expect(screen.getByLabelText("Ad")).toHaveValue("Market");
    await user.clear(screen.getByLabelText("Ad"));
    await user.type(screen.getByLabelText("Ad"), "Ev marketi");
    await user.clear(screen.getByLabelText("Sıra"));
    await user.type(screen.getByLabelText("Sıra"), "4");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() =>
      expect(onSaveCategory).toHaveBeenCalledWith({
        mode: "update",
        id: "category-1",
        name: "Ev marketi",
        sortOrder: 4,
        version: 3,
      }),
    );
  });

  it("closes a blank category form without submitting or triggering validation", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Kategori" }));
    await user.click(screen.getByRole("button", { name: "Vazgeç" }));

    expect(onSaveCategory).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Kategori" })).not.toBeInTheDocument();
  });

  it("keeps a rejected save error inside the open category dialog", async () => {
    const user = userEvent.setup();
    const onSaveCategory = vi.fn(() =>
      Promise.reject(new Error("Kategori adı zaten kullanılıyor.")),
    );

    render(
      <SettingsPage
        model={settingsModel()}
        actions={settingsActions({ onSaveCategory })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Kategori" }));
    await user.type(screen.getByLabelText("Ad"), "Market");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    const error = await screen.findByRole("alert");
    expect(error).toHaveTextContent("Kategori adı zaten kullanılıyor.");
    expect(error.closest("dialog")).toBe(
      screen.getByRole("dialog", { name: "Kategori" }),
    );
  });
});

describe("SettingsPage cost center management", () => {
  it("creates a cost center with its optional description and order", async () => {
    const user = userEvent.setup();
    const onSaveCostCenter = vi.fn(() => Promise.resolve());

    render(
      <SettingsPage
        model={settingsModel([], [])}
        actions={settingsActions({ onSaveCostCenter })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "+ Masraf merkezi" }));
    const dialog = screen.getByRole("dialog", { name: "Masraf merkezi" });
    await user.type(screen.getByLabelText("Ad"), "Aile arabası");
    await user.type(screen.getByLabelText("Açıklama"), "Yakıt ve bakım");
    await user.clear(screen.getByLabelText("Sıra"));
    await user.type(screen.getByLabelText("Sıra"), "12");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSaveCostCenter).toHaveBeenCalledWith({
        mode: "create",
        name: "Aile arabası",
        description: "Yakıt ve bakım",
        sortOrder: 12,
      });
    });
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
  });

  it("edits an existing cost center", async () => {
    const user = userEvent.setup();
    const onSaveCostCenter = vi.fn(() => Promise.resolve());
    const { container } = render(
      <SettingsPage
        model={settingsModel([], [activeCostCenter])}
        actions={settingsActions({ onSaveCostCenter })}
      />,
    );

    await user.click(
      container.querySelector<HTMLButtonElement>(
        `[data-edit-cost-center="${activeCostCenter.id}"]`,
      )!,
    );
    expect(screen.getByLabelText("Ad")).toHaveValue("Aile arabası");
    await user.clear(screen.getByLabelText("Ad"));
    await user.type(screen.getByLabelText("Ad"), "Günlük araç");
    await user.clear(screen.getByLabelText("Açıklama"));
    await user.type(screen.getByLabelText("Açıklama"), "Yeni açıklama");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => {
      expect(onSaveCostCenter).toHaveBeenCalledWith({
        mode: "update",
        id: activeCostCenter.id,
        version: activeCostCenter.version,
        name: "Günlük araç",
        description: "Yeni açıklama",
        sortOrder: activeCostCenter.sortOrder,
      });
    });
  });

  it("deactivates an active cost center and reactivates an inactive one", async () => {
    const user = userEvent.setup();
    const onDeleteCostCenter = vi.fn(() => Promise.resolve());
    const onActivateCostCenter = vi.fn(() => Promise.resolve());
    const confirmAction = vi.fn(() => true);
    const { container } = render(
      <SettingsPage
        model={settingsModel([], [activeCostCenter, inactiveCostCenter])}
        actions={settingsActions({ onDeleteCostCenter, onActivateCostCenter })}
        confirmAction={confirmAction}
      />,
    );

    await user.click(
      container.querySelector<HTMLButtonElement>(
        `[data-delete-cost-center="${activeCostCenter.id}"]`,
      )!,
    );
    await waitFor(() => {
      expect(onDeleteCostCenter).toHaveBeenCalledWith({
        id: activeCostCenter.id,
        version: activeCostCenter.version,
      });
    });
    expect(confirmAction).toHaveBeenCalledWith(
      expect.stringContaining(activeCostCenter.name),
    );

    await user.click(
      container.querySelector<HTMLButtonElement>(
        `[data-activate-cost-center="${inactiveCostCenter.id}"]`,
      )!,
    );
    await waitFor(() => {
      expect(onActivateCostCenter).toHaveBeenCalledWith({
        id: inactiveCostCenter.id,
        version: inactiveCostCenter.version,
      });
    });
  });
});
