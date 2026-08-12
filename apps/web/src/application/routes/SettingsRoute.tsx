import { useAuth } from "../../auth/AuthProvider";
import { isoAtLocalNoon } from "../../lib/date";
import { SettingsPage, type SettingsActions } from "../../modules/settings";
import { Configuration } from "../../platform/config/runtime-config";
import { useFinance } from "../../providers/FinanceProvider";
import { useToast } from "../ToastProvider";

export function SettingsRoute() {
  const { changePassword, logout } = useAuth();
  const { showToast } = useToast();
  const { apiStatus, mutate, service, snapshot } = useFinance();

  const actions: SettingsActions = {
    onLogout: logout,
    onChangePassword: async (input) => {
      await changePassword(input);
      showToast("Şifreniz güncellendi.");
    },
    onSaveCategory: async (input) => {
      if (input.mode === "create") {
        await mutate(() => service.createCategory(input), "Kategori eklendi.");
      } else {
        await mutate(
          () => service.updateCategory(input.id, {
            name: input.name,
            sortOrder: input.sortOrder,
            version: input.version,
          }),
          "Kategori güncellendi.",
        );
      }
    },
    onDeleteCategory: async ({ id, version }) => {
      await mutate(() => service.deleteCategory(id, version), "Kategori silindi veya pasife alındı.");
    },
    onActivateCategory: async ({ id, version }) => {
      await mutate(() => service.updateCategory(id, { isActive: true, version }), "Kategori etkinleştirildi.");
    },
    onSaveCostCenter: async (input) => {
      if (input.mode === "create") {
        await mutate(
          () => service.createCostCenter({
            name: input.name,
            description: input.description,
            sortOrder: input.sortOrder,
          }),
          "Masraf merkezi eklendi.",
        );
      } else {
        await mutate(
          () => service.updateCostCenter(input.id, {
            name: input.name,
            description: input.description,
            sortOrder: input.sortOrder,
            version: input.version,
          }),
          "Masraf merkezi güncellendi.",
        );
      }
    },
    onDeleteCostCenter: async ({ id, version }) => {
      await mutate(
        () => service.deleteCostCenter(id, version),
        "Masraf merkezi silindi veya pasife alındı.",
      );
    },
    onActivateCostCenter: async ({ id, version }) => {
      await mutate(
        () => service.updateCostCenter(id, { isActive: true, version }),
        "Masraf merkezi etkinleştirildi.",
      );
    },
    onSaveInvestmentType: async (input) => {
      if (input.mode === "create") {
        await mutate(
          () => service.createAssetType({ name: input.name, sortOrder: input.sortOrder }),
          "Birikim türü eklendi.",
        );
      } else {
        await mutate(
          () => service.updateAssetType(input.id, {
            name: input.name,
            sortOrder: input.sortOrder,
            version: input.version,
          }),
          "Birikim türü güncellendi.",
        );
      }
    },
    onDeleteInvestmentType: async ({ id, version }) => {
      await mutate(() => service.deleteAssetType(id, version), "Birikim türü silindi veya pasife alındı.");
    },
    onActivateInvestmentType: async ({ id, version }) => {
      await mutate(() => service.updateAssetType(id, { isActive: true, version }), "Birikim türü etkinleştirildi.");
    },
    onSaveInstrument: async (input) => {
      if (input.mode === "create") {
        await mutate(
          () => service.createInstrument({
            assetTypeId: input.assetTypeId,
            name: input.name,
            symbol: input.symbol,
          }),
          "Yatırım aracı eklendi.",
        );
      } else {
        await mutate(
          () => service.updateInstrument(input.id, {
            assetTypeId: input.assetTypeId,
            name: input.name,
            symbol: input.symbol,
            version: input.version,
          }),
          "Yatırım aracı güncellendi.",
        );
      }
    },
    onDeleteInstrument: async ({ id, version }) => {
      await mutate(() => service.deleteInstrument(id, version), "Yatırım aracı silindi veya pasife alındı.");
    },
    onActivateInstrument: async ({ id, version }) => {
      await mutate(() => service.updateInstrument(id, { isActive: true, version }), "Yatırım aracı etkinleştirildi.");
    },
    onSaveInstrumentPrice: async ({ instrumentId, price, pricedAt }) => {
      await mutate(
        () => service.setPrice(instrumentId, { price, pricedAt: pricedAt.includes("T") ? pricedAt : isoAtLocalNoon(pricedAt) }),
        "Son fiyat kaydedildi.",
      );
    },
  };

  return (
    <SettingsPage
      actions={actions}
      model={{
        apiBaseUrl: Configuration.apiBaseUrl,
        apiStatus: { online: apiStatus?.online ?? false, reason: apiStatus?.reason },
        book: snapshot.book,
        categories: snapshot.categories,
        costCenters: snapshot.costCenters,
        instruments: snapshot.instruments,
        investmentTypes: snapshot.investmentTypes,
        user: snapshot.user,
      }}
    />
  );
}
