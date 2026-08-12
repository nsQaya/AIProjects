import { useState } from "react";
import type {
  CategoryDTO,
  CostCenterDTO,
  InvestmentAssetTypeDTO,
  InvestmentInstrumentDTO,
} from "@defterx/contracts";

import { InlineFeedback } from "../../components/ui";
import { dateText, money } from "../../lib/format";
import {
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
  const online = model.apiStatus.online;

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
          <div className="management-list compact-list">
            {model.instruments.map((item) => {
              const latestPriceText =
                item.latestPrice !== null && item.latestPriceAt !== null
                  ? `${money(item.latestPrice)} · ${dateText(item.latestPriceAt)}`
                  : "Fiyat yok";
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
                    <button
                      type="button"
                      data-price-instrument={item.id}
                      disabled={pendingAction !== null}
                      onClick={() => setDialog({ type: "price", item })}
                    >
                      Fiyat gir
                    </button>
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
      </div>

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
          instrument={dialog.item}
          investmentTypes={model.investmentTypes}
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
