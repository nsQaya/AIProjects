import { useEffect, useMemo, useState } from "react";
import type {
  AccountTypeDTO,
  CategoryDTO,
  CostCenterDTO,
  CurrencyRateAtDateDTO,
  CurrencyRateSyncRunDTO,
  InvestmentAssetTypeDTO,
  InvestmentInstrumentDTO,
  InvestmentPriceAtDateDTO,
  MarketPriceSyncRunDTO,
} from "@defterx/contracts";

import { InlineFeedback } from "../../components/ui";
import { today } from "../../lib/date";
import { moneyInCurrency } from "../../lib/format";
import {
  AccountTypeDialog,
  CategoryDialog,
  CostCenterDialog,
  InstrumentDialog,
  InstrumentPriceDialog,
  InvestmentTypeDialog,
  PasswordChangeDialog,
} from "./SettingsDialogs";
import type {
  ConfirmSettingsAction,
  SettingsActions,
  SettingsViewModel,
  VersionedSettingsEntity,
} from "./settings-types";

type SettingsDialogState =
  | { type: "account-type"; item: AccountTypeDTO | null }
  | { type: "category"; item: CategoryDTO | null }
  | { type: "cost-center"; item: CostCenterDTO | null }
  | { type: "instrument"; item: InvestmentInstrumentDTO | null }
  | { type: "investment-type"; item: InvestmentAssetTypeDTO | null }
  | { type: "password" }
  | { type: "price"; item: InvestmentInstrumentDTO };

export interface SettingsPageProps {
  actions: SettingsActions;
  confirmAction?: ConfirmSettingsAction;
  model: SettingsViewModel;
}

function defaultConfirmAction(message: string): boolean {
  return globalThis.confirm(message);
}

function actionErrorMessage(error: unknown): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : "İşlem tamamlanamadı.";
}

export function SettingsPage({
  actions,
  confirmAction = defaultConfirmAction,
  model,
}: SettingsPageProps) {
  const [dialog, setDialog] = useState<SettingsDialogState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [priceDate,setPriceDate]=useState(today());
  const [datedPrices,setDatedPrices]=useState<readonly InvestmentPriceAtDateDTO[]>([]);
  const [priceLoading,setPriceLoading]=useState(true);
  const [syncRun,setSyncRun]=useState<MarketPriceSyncRunDTO|null>(null);
  const [rateDate,setRateDate]=useState(today());
  const [datedRates,setDatedRates]=useState<readonly CurrencyRateAtDateDTO[]>([]);
  const [rateLoading,setRateLoading]=useState(true);
  const [currencySyncRun,setCurrencySyncRun]=useState<CurrencyRateSyncRunDTO|null>(null);
  const online = model.apiStatus.online;
  const datedPriceMap=useMemo(()=>new Map(datedPrices.map(item=>[item.instrumentId,item])),[datedPrices]);
  const datedRateMap=useMemo(()=>new Map(datedRates.map(item=>[item.currencyCode,item])),[datedRates]);

  useEffect(()=>{
    let active=true;
    void Promise.all([
      actions.onLoadInstrumentPrices(priceDate),
      actions.onMarketPriceSyncStatus(priceDate),
    ]).then(([prices,run])=>{
      if(active){setDatedPrices(prices);setSyncRun(run);}
    }).catch(error=>{if(active)setActionError(actionErrorMessage(error));})
      .finally(()=>{if(active)setPriceLoading(false);});
    return()=>{active=false;};
  },[actions,priceDate]);

  useEffect(()=>{
    if(syncRun?.status!=="QUEUED"&&syncRun?.status!=="RUNNING")return;
    const timer=window.setInterval(()=>{
      void actions.onMarketPriceSyncStatus(priceDate).then(async run=>{
        setSyncRun(run);
        if(run?.status==="COMPLETED")setDatedPrices(await actions.onLoadInstrumentPrices(priceDate));
      }).catch(()=>undefined);
    },4000);
    return()=>window.clearInterval(timer);
  },[actions,priceDate,syncRun?.status]);

  const syncMarketPrices=async()=>{
    if(priceLoading)return;
    setPriceLoading(true);
    setActionError(null);
    try{setSyncRun(await actions.onSyncMarketPrices(priceDate));}
    catch(error){setActionError(actionErrorMessage(error));}
    finally{setPriceLoading(false);}
  };

  useEffect(()=>{
    let active=true;
    void Promise.all([
      actions.onLoadCurrencyRates(rateDate),
      actions.onCurrencyRateSyncStatus(rateDate),
    ]).then(([rates,run])=>{
      if(active){setDatedRates(rates);setCurrencySyncRun(run);}
    }).catch(error=>{if(active)setActionError(actionErrorMessage(error));})
      .finally(()=>{if(active)setRateLoading(false);});
    return()=>{active=false;};
  },[actions,rateDate]);

  useEffect(()=>{
    if(currencySyncRun?.status!=="QUEUED"&&currencySyncRun?.status!=="RUNNING")return;
    const timer=window.setInterval(()=>{
      void actions.onCurrencyRateSyncStatus(rateDate).then(async run=>{
        setCurrencySyncRun(run);
        if(run?.status==="COMPLETED")setDatedRates(await actions.onLoadCurrencyRates(rateDate));
      }).catch(()=>undefined);
    },4000);
    return()=>window.clearInterval(timer);
  },[actions,rateDate,currencySyncRun?.status]);

  const syncCurrencyRates=async()=>{
    if(rateLoading)return;
    setRateLoading(true);
    setActionError(null);
    try{setCurrencySyncRun(await actions.onSyncCurrencyRates(rateDate));}
    catch(error){setActionError(actionErrorMessage(error));}
    finally{setRateLoading(false);}
  };

  const runAction = async (key: string, action: () => Promise<void>) => {
    if (pendingAction !== null) return;
    setPendingAction(key);
    setActionError(null);
    try {
      await action();
    } catch (error: unknown) {
      setActionError(actionErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  const runConfirmedAction = (
    key: string,
    message: string,
    action: () => Promise<void>,
  ) => {
    if (!confirmAction(message)) return;
    void runAction(key, action);
  };

  const versioned = (entity: VersionedSettingsEntity): VersionedSettingsEntity => ({
    id: entity.id,
    version: entity.version,
  });

  return (
    <section className="page-section settings-stack">
      <div className="settings-grid">
        <article className="panel settings-card">
          <h2>Canlı ortam</h2>
          <div className="settings-row">
            <span>Web uygulaması</span>
            <b>Cloudflare Workers</b>
          </div>
          <div className="settings-row">
            <span>API ve Neon</span>
            <b className={online ? "income" : "expense"}>
              {online ? "Bağlı" : "Bağlantı hatası"}
            </b>
          </div>
          <div className="settings-row">
            <span>Aktif defter</span>
            <b>{model.book?.name ?? "—"}</b>
          </div>
          <div className="settings-row">
            <span>API adresi</span>
            <code>{model.apiBaseUrl || "Tanımsız"}</code>
          </div>
          <p className="connection-detail">{model.apiStatus.reason ?? ""}</p>
          <button
            className="secondary-button"
            id="logout-button"
            type="button"
            disabled={pendingAction !== null}
            onClick={() => void runAction("logout", actions.onLogout)}
          >
            {pendingAction === "logout" ? "Oturum kapatılıyor…" : "Oturumu kapat"}
          </button>
        </article>

        <article className="panel settings-card">
          <h2>Profil ve güvenlik</h2>
          <div className="settings-row">
            <span>Hesap sahibi</span>
            <b>{model.user?.displayName || "—"}</b>
          </div>
          <div className="settings-row">
            <span>E-posta</span>
            <b>{model.user?.email || "—"}</b>
          </div>
          <p>Şifrenizi düzenli aralıklarla yenileyerek hesabınızı koruyabilirsiniz.</p>
          <button
            className="secondary-button"
            id="open-password-change-dialog"
            type="button"
            onClick={() => setDialog({ type: "password" })}
          >
            Şifreyi değiştir
          </button>
        </article>
      </div>

      <article className="panel settings-card">
        <h2>Veri ilkeleri</h2>
        <p>
          Tüm finansal kayıtlar canlı API üzerinden Neon PostgreSQL’de tutulur.
          Tarayıcıda demo bakiye veya demo işlem saklanmaz.
        </p>
        <div className="settings-row">
          <span>Para birimi</span>
          <b>{model.book?.baseCurrency ?? "TRY"}</b>
        </div>
      </article>

      {actionError ? <InlineFeedback tone="error">{actionError}</InlineFeedback> : null}

      <article className="panel settings-card">
        <header className="panel-head">
          <div>
            <h2>Kategoriler</h2>
            <p>
              Kullanılmış kategori silinmek yerine pasife alınır; geçmiş raporlarda
              korunur.
            </p>
          </div>
          <button
            className="secondary-button"
            id="open-category-dialog"
            type="button"
            onClick={() => setDialog({ type: "category", item: null })}
          >
            + Kategori
          </button>
        </header>
        <div className="management-list">
          {model.categories.map((item) => {
            const deleteKey = `delete-category:${item.id}`;
            const activateKey = `activate-category:${item.id}`;
            return (
              <div key={item.id}>
                <span>
                  <b>{item.name}</b>
                  <small>
                    {item.categoryType === "INCOME" ? "Gelir" : "Gider"}
                    {item.isActive ? "" : " · Pasif"}
                  </small>
                </span>
                <span className="row-actions">
                  <button
                    type="button"
                    data-edit-category={item.id}
                    disabled={pendingAction !== null}
                    onClick={() => setDialog({ type: "category", item })}
                  >
                    Düzenle
                  </button>
                  {item.isActive ? (
                    <button
                      type="button"
                      className="danger-link"
                      data-delete-category={item.id}
                      disabled={pendingAction !== null}
                      onClick={() =>
                        runConfirmedAction(
                          deleteKey,
                          `“${item.name}” silinsin mi? Kullanılmışsa pasife alınacaktır.`,
                          () => actions.onDeleteCategory(versioned(item)),
                        )
                      }
                    >
                      {pendingAction === deleteKey ? "İşleniyor…" : "Sil / pasif al"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-activate-category={item.id}
                      disabled={pendingAction !== null}
                      onClick={() =>
                        void runAction(activateKey, () =>
                          actions.onActivateCategory(versioned(item)),
                        )
                      }
                    >
                      {pendingAction === activateKey ? "Etkinleştiriliyor…" : "Etkinleştir"}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {model.categories.length === 0 ? (
            <div className="empty-state">Henüz kategori tanımlanmadı.</div>
          ) : null}
        </div>
      </article>

      <article className="panel settings-card">
        <header className="panel-head">
          <div>
            <h2>Masraf merkezleri</h2>
            <p>
              Kategorinin yanında ikinci bir kırılım sağlar. Örneğin “Yakıt”
              kategorisini “Aile arabası” masraf merkeziyle takip edebilirsiniz.
            </p>
          </div>
          <button
            className="secondary-button"
            id="open-cost-center-dialog"
            type="button"
            onClick={() => setDialog({ type: "cost-center", item: null })}
          >
            + Masraf merkezi
          </button>
        </header>
        <div className="management-list">
          {model.costCenters.map((item) => {
            const deleteKey = `delete-cost-center:${item.id}`;
            const activateKey = `activate-cost-center:${item.id}`;
            return (
              <div key={item.id}>
                <span>
                  <b>{item.name}</b>
                  <small>
                    {item.description || "Açıklama yok"}
                    {item.isActive ? "" : " · Pasif"}
                  </small>
                </span>
                <span className="row-actions">
                  <button
                    type="button"
                    data-edit-cost-center={item.id}
                    disabled={pendingAction !== null}
                    onClick={() => setDialog({ type: "cost-center", item })}
                  >
                    Düzenle
                  </button>
                  {item.isActive ? (
                    <button
                      type="button"
                      className="danger-link"
                      data-delete-cost-center={item.id}
                      disabled={pendingAction !== null}
                      onClick={() =>
                        runConfirmedAction(
                          deleteKey,
                          `“${item.name}” silinsin mi? Kullanılmışsa pasife alınacaktır.`,
                          () => actions.onDeleteCostCenter(versioned(item)),
                        )
                      }
                    >
                      {pendingAction === deleteKey ? "İşleniyor…" : "Sil / pasif al"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      data-activate-cost-center={item.id}
                      disabled={pendingAction !== null}
                      onClick={() =>
                        void runAction(activateKey, () =>
                          actions.onActivateCostCenter(versioned(item)),
                        )
                      }
                    >
                      {pendingAction === activateKey ? "Etkinleştiriliyor…" : "Etkinleştir"}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
          {model.costCenters.length === 0 ? (
            <div className="empty-state">Henüz masraf merkezi tanımlanmadı.</div>
          ) : null}
        </div>
      </article>

      <div className="settings-grid">
        <article className="panel settings-card">
          <header className="panel-head">
            <div>
              <h2>Hesap türleri</h2>
              <p>Hesaplar sayfasında seçilebilen türler</p>
            </div>
            <button
              className="secondary-button"
              id="open-account-type-dialog"
              type="button"
              onClick={() => setDialog({ type: "account-type", item: null })}
            >
              + Tür
            </button>
          </header>
          <div className="management-list compact-list">
            {model.accountTypes.map((item) => {
              const deleteKey = `delete-account-type:${item.id}`;
              const activateKey = `activate-account-type:${item.id}`;
              return (
                <div key={item.id}>
                  <span>
                    <b>{item.name}</b>
                    <small>{item.isActive ? "Aktif" : "Pasif"}</small>
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      data-edit-account-type={item.id}
                      disabled={pendingAction !== null}
                      onClick={() => setDialog({ type: "account-type", item })}
                    >
                      Düzenle
                    </button>
                    {item.isActive ? (
                      <button
                        type="button"
                        className="danger-link"
                        data-delete-account-type={item.id}
                        disabled={pendingAction !== null}
                        onClick={() =>
                          runConfirmedAction(
                            deleteKey,
                            item.isSystem
                              ? `“${item.name}” pasife alınsın mı? Sistem türleri silinemez.`
                              : `“${item.name}” silinsin mi? Kullanılıyorsa pasife alınacaktır.`,
                            () => actions.onDeleteAccountType(versioned(item)),
                          )
                        }
                      >
                        {pendingAction === deleteKey
                          ? "İşleniyor…"
                          : item.isSystem
                            ? "Pasif al"
                            : "Sil / pasif al"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-activate-account-type={item.id}
                        disabled={pendingAction !== null}
                        onClick={() =>
                          void runAction(activateKey, () =>
                            actions.onActivateAccountType(versioned(item)),
                          )
                        }
                      >
                        {pendingAction === activateKey
                          ? "Etkinleştiriliyor…"
                          : "Etkinleştir"}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
            {model.accountTypes.length === 0 ? (
              <div className="empty-state">Henüz hesap türü tanımlanmadı.</div>
            ) : null}
          </div>
        </article>

        <article className="panel settings-card">
          <header className="panel-head">
            <div>
              <h2>Birikim türleri</h2>
              <p>Hisse, fon, ETF ve özel türler</p>
            </div>
            <button
              className="secondary-button"
              id="open-asset-type-dialog"
              type="button"
              onClick={() => setDialog({ type: "investment-type", item: null })}
            >
              + Tür
            </button>
          </header>
          <div className="management-list compact-list">
            {model.investmentTypes.map((item) => {
              const deleteKey = `delete-investment-type:${item.id}`;
              const activateKey = `activate-investment-type:${item.id}`;
              return (
                <div key={item.id}>
                  <span>
                    <b>{item.name}</b>
                    <small>{item.isActive ? "Aktif" : "Pasif"}</small>
                  </span>
                  <span className="row-actions">
                    <button
                      type="button"
                      data-edit-asset-type={item.id}
                      disabled={pendingAction !== null}
                      onClick={() => setDialog({ type: "investment-type", item })}
                    >
                      Düzenle
                    </button>
                    {item.isActive ? (
                      <button
                        type="button"
                        className="danger-link"
                        data-delete-asset-type={item.id}
                        disabled={pendingAction !== null}
                        onClick={() =>
                          runConfirmedAction(
                            deleteKey,
                            `“${item.name}” silinsin mi? Kullanılıyorsa pasife alınacaktır.`,
                            () => actions.onDeleteInvestmentType(versioned(item)),
                          )
                        }
                      >
                        {pendingAction === deleteKey ? "İşleniyor…" : "Sil / pasif al"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-activate-asset-type={item.id}
                        disabled={pendingAction !== null}
                        onClick={() =>
                          void runAction(activateKey, () =>
                            actions.onActivateInvestmentType(versioned(item)),
                          )
                        }
                      >
                        {pendingAction === activateKey
                          ? "Etkinleştiriliyor…"
                          : "Etkinleştir"}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
            {model.investmentTypes.length === 0 ? (
              <div className="empty-state">Henüz birikim türü tanımlanmadı.</div>
            ) : null}
          </div>
        </article>

        <article className="panel settings-card">
          <header className="panel-head">
            <div>
              <h2>Yatırım araçları ve fiyatlar</h2>
              <p>Takip ettiğiniz menkul kıymetler</p>
            </div>
            <button
              className="secondary-button"
              id="open-instrument-dialog"
              type="button"
              onClick={() => setDialog({ type: "instrument", item: null })}
            >
              + Araç
            </button>
          </header>
          <div className="market-price-toolbar">
            <label>
              <span>Fiyat tarihi</span>
              <input type="date" value={priceDate} onChange={event=>{setPriceLoading(true);setPriceDate(event.target.value);}} />
            </label>
            <button className="secondary-button" type="button" disabled={priceLoading||syncRun?.status==="QUEUED"||syncRun?.status==="RUNNING"} onClick={()=>void syncMarketPrices()}>
              {syncRun?.status==="QUEUED"||syncRun?.status==="RUNNING"?"Tüm piyasa güncelleniyor…":"Tüm piyasanın fiyatını güncelle"}
            </button>
            {syncRun?<small>
              {syncRun.status==="COMPLETED"
                ? `${syncRun.updatedItems} fiyat güncellendi · ${syncRun.missingItems} kodda o gün fiyat yok`
                : syncRun.status==="FAILED"?"Fiyat güncellemesi tamamlanamadı.":`${syncRun.processedItems}/${syncRun.totalItems} kod işlendi`}
            </small>:null}
          </div>
          <div className="management-list compact-list">
            {model.instruments.map((item) => {
              const datedPrice=datedPriceMap.get(item.id);
              const latestPriceText=priceLoading&&!datedPrice
                ? "Fiyat yükleniyor…"
                : `${moneyInCurrency(datedPrice?.price??0,item.currencyCode)} · ${datedPrice?.available?(datedPrice.source==="YAHOO"?"Yahoo kapanış":"Manuel fiyat"):"O gün fiyat yok"}`;
              const deleteKey = `delete-instrument:${item.id}`;
              const activateKey = `activate-instrument:${item.id}`;
              return (
                <div key={item.id}>
                  <span>
                    <b>
                      {item.name} {item.symbol ? `(${item.symbol})` : ""}
                    </b>
                    <small>
                      {item.assetTypeName} ·{" "}
                      {latestPriceText}
                      {item.isActive ? "" : " · Pasif"}
                    </small>
                  </span>
                  <span className="row-actions">
                    {item.marketSymbolId?(
                      <button type="button" data-sync-instrument={item.id} disabled={pendingAction!==null||priceLoading} onClick={()=>void syncMarketPrices()}>
                        Fiyatı güncelle
                      </button>
                    ):(
                      <button type="button" data-price-instrument={item.id} disabled={pendingAction !== null} onClick={() => setDialog({ type: "price", item })}>
                        Elle fiyat gir
                      </button>
                    )}
                    <button
                      type="button"
                      data-edit-instrument={item.id}
                      disabled={pendingAction !== null}
                      onClick={() => setDialog({ type: "instrument", item })}
                    >
                      Düzenle
                    </button>
                    {item.isActive ? (
                      <button
                        type="button"
                        className="danger-link"
                        data-delete-instrument={item.id}
                        disabled={pendingAction !== null}
                        onClick={() =>
                          runConfirmedAction(
                            deleteKey,
                            `“${item.name}” silinsin mi? Portföydeyse pasife alınacaktır.`,
                            () => actions.onDeleteInstrument(versioned(item)),
                          )
                        }
                      >
                        {pendingAction === deleteKey ? "İşleniyor…" : "Sil"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        data-activate-instrument={item.id}
                        disabled={pendingAction !== null}
                        onClick={() =>
                          void runAction(activateKey, () =>
                            actions.onActivateInstrument(versioned(item)),
                          )
                        }
                      >
                        {pendingAction === activateKey
                          ? "Etkinleştiriliyor…"
                          : "Etkinleştir"}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
            {model.instruments.length === 0 ? (
              <div className="empty-state">Henüz yatırım aracı tanımlanmadı.</div>
            ) : null}
          </div>
        </article>

        <article className="panel settings-card">
          <h2>Para Birimleri</h2>
          <div className="market-price-toolbar">
            <label>
              <span>Kur tarihi</span>
              <input type="date" value={rateDate} onChange={event=>{setRateLoading(true);setRateDate(event.target.value);}} />
            </label>
            <button className="secondary-button" type="button" disabled={rateLoading||currencySyncRun?.status==="QUEUED"||currencySyncRun?.status==="RUNNING"} onClick={()=>void syncCurrencyRates()}>
              {currencySyncRun?.status==="QUEUED"||currencySyncRun?.status==="RUNNING"?"Kurlar güncelleniyor…":"TCMB kurlarını güncelle"}
            </button>
            {currencySyncRun?<small>
              {currencySyncRun.status==="COMPLETED"
                ? `${currencySyncRun.updatedItems} kur güncellendi`
                : currencySyncRun.status==="FAILED"?"Kur güncellemesi tamamlanamadı.":`${currencySyncRun.processedItems}/${currencySyncRun.totalItems} kur işlendi`}
            </small>:null}
          </div>
          <div className="management-list compact-list">
            {model.currencies.map((item) => {
              const rate=datedRateMap.get(item.code);
              const enableKey=`enable-currency:${item.code}`;
              const disableKey=`disable-currency:${item.code}`;
              return (
                <div key={item.code}>
                  <span>
                    <b>{item.code} <small>{item.nameTr}</small></b>
                    {item.isEnabled ? (
                      <small>
                        {item.code==="TRY"
                          ? "Baz para birimi"
                          : rateLoading&&!rate ? "Kur yükleniyor…"
                          : rate?.available ? `${moneyInCurrency(rate.tryRate,"TRY")}`
                          : "O gün kur yok"}
                      </small>
                    ) : null}
                  </span>
                  {item.code==="TRY" ? null : (
                    <span className="row-actions">
                      {item.isEnabled ? (
                        <button
                          type="button"
                          className="danger-link"
                          data-disable-currency={item.code}
                          disabled={pendingAction !== null}
                          onClick={() =>
                            runConfirmedAction(
                              disableKey,
                              `“${item.nameTr}” kaldırılsın mı?`,
                              () => actions.onDisableCurrency(item.code),
                            )
                          }
                        >
                          {pendingAction === disableKey ? "İşleniyor…" : "Kaldır"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          data-enable-currency={item.code}
                          disabled={pendingAction !== null}
                          onClick={() =>
                            void runAction(enableKey, () => actions.onEnableCurrency(item.code))
                          }
                        >
                          {pendingAction === enableKey ? "Ekleniyor…" : "Ekle"}
                        </button>
                      )}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </article>
      </div>

      {dialog?.type === "account-type" ? (
        <AccountTypeDialog
          key={`account-type:${dialog.item?.id ?? "new"}`}
          accountType={dialog.item}
          onClose={() => setDialog(null)}
          onSave={actions.onSaveAccountType}
        />
      ) : null}
      {dialog?.type === "category" ? (
        <CategoryDialog
          key={`category:${dialog.item?.id ?? "new"}`}
          category={dialog.item}
          onClose={() => setDialog(null)}
          onSave={actions.onSaveCategory}
        />
      ) : null}
      {dialog?.type === "cost-center" ? (
        <CostCenterDialog
          key={`cost-center:${dialog.item?.id ?? "new"}`}
          costCenter={dialog.item}
          onClose={() => setDialog(null)}
          onSave={actions.onSaveCostCenter}
        />
      ) : null}
      {dialog?.type === "investment-type" ? (
        <InvestmentTypeDialog
          key={`investment-type:${dialog.item?.id ?? "new"}`}
          investmentType={dialog.item}
          onClose={() => setDialog(null)}
          onSave={actions.onSaveInvestmentType}
        />
      ) : null}
      {dialog?.type === "instrument" ? (
        <InstrumentDialog
          key={`instrument:${dialog.item?.id ?? "new"}`}
          currencies={model.currencies}
          instrument={dialog.item}
          investmentTypes={model.investmentTypes}
          onSearchMarketSymbols={actions.onSearchMarketSymbols}
          onClose={() => setDialog(null)}
          onSave={actions.onSaveInstrument}
        />
      ) : null}
      {dialog?.type === "price" ? (
        <InstrumentPriceDialog
          key={`price:${dialog.item.id}`}
          instrument={dialog.item}
          onClose={() => setDialog(null)}
          onSave={actions.onSaveInstrumentPrice}
        />
      ) : null}
      {dialog?.type === "password" ? (
        <PasswordChangeDialog
          onClose={() => setDialog(null)}
          onSave={actions.onChangePassword}
        />
      ) : null}
    </section>
  );
}
