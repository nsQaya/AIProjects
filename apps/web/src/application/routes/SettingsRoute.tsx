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
    onSaveAccountType: async (input) => {
      if (input.mode === "create") {
        await mutate(
          () => service.createAccountType({
            name: input.name,
            normalBalance: input.normalBalance,
            defaultAllowNegativeBalance: input.defaultAllowNegativeBalance,
            isInvestment: input.isInvestment,
            sortOrder: input.sortOrder,
          }),
          "Hesap türü eklendi.",
        );
      } else {
        await mutate(
          () => service.updateAccountType(input.id, {
            name: input.name,
            normalBalance: input.normalBalance,
            defaultAllowNegativeBalance: input.defaultAllowNegativeBalance,
            isInvestment: input.isInvestment,
            sortOrder: input.sortOrder,
            version: input.version,
          }),
          "Hesap türü güncellendi.",
        );
      }
    },
    onDeleteAccountType: async ({ id, version }) => {
      await mutate(() => service.deleteAccountType(id, version), "Hesap türü silindi veya pasife alındı.");
    },
    onActivateAccountType: async ({ id, version }) => {
      await mutate(() => service.updateAccountType(id, { isActive: true, version }), "Hesap türü etkinleştirildi.");
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
            marketSymbolId: input.marketSymbolId,
            currencyCode: input.currencyCode,
          }),
          "Yatırım aracı eklendi.",
        );
      } else {
        await mutate(
          () => service.updateInstrument(input.id, {
            assetTypeId: input.assetTypeId,
            name: input.name,
            symbol: input.symbol,
            marketSymbolId: input.marketSymbolId,
            currencyCode: input.currencyCode,
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
    onSearchMarketSymbols: async (query,market) => (await service.searchMarketSymbols(query,market)).items,
    onLoadInstrumentPrices: async (date) => (await service.instrumentPricesAtDate(date)).items,
    onSyncMarketPrices: async (date) => {
      const run=await service.syncMarketPrices(date);
      showToast("Seçili gün için tüm piyasa fiyatları güncelleme kuyruğuna alındı.");
      return run;
    },
    onMarketPriceSyncStatus: (date) => service.marketPriceSyncStatus(date),
    onEnableCurrency: async (code) => {
      await mutate(() => service.enableCurrency(code), "Para birimi eklendi.");
    },
    onDisableCurrency: async (code) => {
      await mutate(() => service.disableCurrency(code), "Para birimi kaldırıldı.");
    },
    onLoadCurrencyRates: async (date) => (await service.currencyRatesAtDate(date)).items,
    onSyncCurrencyRates: async (date) => {
      const run = await service.syncCurrencyRates(date);
      showToast("Seçili gün için TCMB kurları güncelleme kuyruğuna alındı.");
      return run;
    },
    onCurrencyRateSyncStatus: (date) => service.currencyRateSyncStatus(date),
  };

  return (
    <SettingsPage
      actions={actions}
      model={{
        apiBaseUrl: Configuration.apiBaseUrl,
        apiStatus: { online: apiStatus?.online ?? false, reason: apiStatus?.reason },
        book: snapshot.book,
        accountTypes: snapshot.accountTypes,
        categories: snapshot.categories,
        costCenters: snapshot.costCenters,
        currencies: snapshot.currencies,
        instruments: snapshot.instruments,
        investmentTypes: snapshot.investmentTypes,
        user: snapshot.user,
      }}
    />
  );
}
