import { useState, type CSSProperties } from "react";

import { Button, InlineFeedback } from "../../components/ui";
import { errorMessage } from "../../lib/error-message";
import { dateText, money, toNumber } from "../../lib/format";
import { isPositiveDecimal } from "./decimal";
import { LotDialog, SaleDialog } from "./InvestmentDialogs";
import type {
  InvestmentLotViewModel,
  InvestmentPageCallbacks,
  InvestmentsPageModel,
  InvestmentSaleViewModel,
} from "./investment-types";

type InvestmentDialogState =
  | { readonly type: "lot"; readonly item: InvestmentLotViewModel | null }
  | { readonly type: "sale"; readonly item: InvestmentSaleViewModel | null };

export interface InvestmentsPageProps extends InvestmentPageCallbacks, InvestmentsPageModel {
  busy?: boolean;
  confirmDeleteLot?: (lot: InvestmentLotViewModel) => boolean | Promise<boolean>;
  confirmDeleteSale?: (sale: InvestmentSaleViewModel, message: string) => boolean | Promise<boolean>;
}

export function InvestmentsPage({
  accounts,
  busy = false,
  confirmDeleteLot = () => globalThis.confirm("Bu birikim alımı silinsin mi?"),
  confirmDeleteSale = (_sale, message) => globalThis.confirm(message),
  instruments,
  lots,
  onCreateLot,
  onCreateSale,
  onDeleteLot,
  onDeleteSale,
  onUpdateLot,
  onUpdateSale,
  portfolio,
  sales,
}: InvestmentsPageProps) {
  const [dialog, setDialog] = useState<InvestmentDialogState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const cost = portfolio.reduce((sum, item) => sum + toNumber(item.costBasis), 0);
  const value = portfolio.reduce(
    (sum, item) => sum + toNumber(item.currentValue ?? item.costBasis),
    0,
  );
  const gain = value - cost;
  const realized = sales.reduce((sum, item) => sum + toNumber(item.gain), 0);
  const canCreateSale = portfolio.some((item) => isPositiveDecimal(item.quantity));

  const runDelete = async (
    key: string,
    confirmed: boolean | Promise<boolean>,
    action: () => Promise<unknown>,
  ) => {
    if (busy || pendingAction !== null || !(await confirmed)) return;
    setPendingAction(key);
    setPageError(null);
    try {
      await action();
    } catch (error) {
      setPageError(errorMessage(error));
    } finally {
      setPendingAction(null);
    }
  };

  const deleteLot = (lot: InvestmentLotViewModel) => {
    void runDelete(
      `lot:${lot.id}`,
      confirmDeleteLot(lot),
      () => onDeleteLot(lot.id, lot.version),
    );
  };

  const deleteSale = (sale: InvestmentSaleViewModel) => {
    const message = `“${sale.instrumentName}” satışı silinsin mi? Hesaba geçen ${money(
      sale.proceeds,
    )} sunucuda ters kayıtla geri alınacaktır.`;
    void runDelete(
      `sale:${sale.id}`,
      confirmDeleteSale(sale, message),
      () => onDeleteSale(sale.id, sale.version),
    );
  };

  return (
    <section className="page-section">
      <div className="section-intro">
        <div>
          <p className="eyebrow">Yatırım portföyü</p>
          <h2>{money(value)}</h2>
          <span>
            Maliyet {money(cost)} · Gerçekleşmemiş{" "}
            <b className={gain < 0 ? "expense" : "income"}>
              {gain >= 0 ? "+" : ""}{money(gain)}
            </b>{" "}
            · Gerçekleşmiş{" "}
            <b className={realized < 0 ? "expense" : "income"}>
              {realized >= 0 ? "+" : ""}{money(realized)}
            </b>
          </span>
        </div>
        <div className="intro-actions">
          <Button
            id="open-sale-dialog"
            variant="secondary"
            disabled={busy || !canCreateSale}
            onClick={() => setDialog({ type: "sale", item: null })}
          >
            Birikim sat
          </Button>
          <Button
            id="open-lot-dialog"
            variant="secondary"
            disabled={busy}
            onClick={() => setDialog({ type: "lot", item: null })}
          >
            + Birikim alımı
          </Button>
        </div>
      </div>

      {pageError ? <InlineFeedback tone="error">{pageError}</InlineFeedback> : null}

      <div className="account-grid">
        {portfolio.length === 0 ? (
          <div className="empty-state">Henüz açık birikim pozisyonu yok.</div>
        ) : (
          portfolio.map((item) => {
            const itemGain = toNumber(item.gain);
            const quantity = toNumber(item.quantity);
            const averageCost = quantity === 0 ? 0 : toNumber(item.costBasis) / quantity;
            const style = {
              "--account": itemGain < 0 ? "#ad5048" : "#287b60",
            } as CSSProperties;

            return (
              <article key={item.instrumentId} className="account-card" style={style}>
                <div className="account-top">
                  <span className="account-symbol" aria-hidden="true">◇</span>
                  <small>{item.assetTypeName}</small>
                </div>
                <div>
                  <small>{item.symbol || item.currencyCode}</small>
                  <h3>{item.name}</h3>
                </div>
                <strong>{money(item.currentValue ?? item.costBasis)}</strong>
                <small>{item.quantity} adet · Ort. maliyet {money(averageCost)}</small>
                <b className={itemGain < 0 ? "expense" : "income"}>
                  {item.latestPrice !== null ? (
                    <>
                      Son fiyat {money(item.latestPrice)}
                      {item.latestPriceAt ? ` · ${dateText(item.latestPriceAt)}` : ""}
                      {" · "}{itemGain >= 0 ? "+" : ""}{money(item.gain ?? "0")}
                      {item.gainPercent !== null ? ` (%${toNumber(item.gainPercent).toFixed(2)})` : ""}
                    </>
                  ) : (
                    "Son fiyat bekleniyor"
                  )}
                </b>
              </article>
            );
          })
        )}
      </div>

      <article className="panel transaction-panel">
        <header className="panel-head">
          <div>
            <h2>Satışlar</h2>
            <p>Satılan adet, satış bedeli ve paranın geçtiği hesap</p>
          </div>
        </header>
        <div className="transaction-table sale-table">
          <div className="table-head">
            <span>Varlık</span><span>Satış tarihi</span><span>Adet</span>
            <span>Satış fiyatı</span><span>Hedef hesap</span><span>Kâr / zarar</span>
            <span>İşlemler</span>
          </div>
          {sales.length === 0 ? (
            <div className="empty-state">Henüz birikim satışı yok.</div>
          ) : (
            sales.map((item) => {
              const deleting = pendingAction === `sale:${item.id}`;
              return (
                <div className="table-row" key={item.id} data-sale-id={item.id}>
                  <span><b>{item.instrumentName}</b></span>
                  <span>{dateText(item.soldAt)}</span>
                  <span>{item.quantity}</span>
                  <span>{money(item.unitPrice)}</span>
                  <span>{item.destinationAccountName}</span>
                  <strong className={toNumber(item.gain) < 0 ? "expense" : "income"}>
                    {toNumber(item.gain) >= 0 ? "+" : ""}{money(item.gain)}
                  </strong>
                  <span className="row-actions">
                    <button
                      type="button"
                      data-edit-sale={item.id}
                      disabled={busy || pendingAction !== null}
                      onClick={() => setDialog({ type: "sale", item })}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="danger-link"
                      data-delete-sale={item.id}
                      disabled={busy || pendingAction !== null}
                      onClick={() => deleteSale(item)}
                    >
                      {deleting ? "İşleniyor…" : "Sil"}
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </article>

      <article className="panel transaction-panel">
        <header className="panel-head">
          <div>
            <h2>Alım lotları</h2>
            <p>Alış fiyatı ve adet detayları</p>
          </div>
        </header>
        <div className="transaction-table investment-table">
          <div className="table-head">
            <span>Varlık</span><span>Alım tarihi</span><span>Adet</span>
            <span>Alış fiyatı</span><span>Maliyet</span><span>İşlemler</span>
          </div>
          {lots.length === 0 ? (
            <div className="empty-state">Henüz birikim alımı yok.</div>
          ) : (
            lots.map((item) => {
              const deleting = pendingAction === `lot:${item.id}`;
              return (
                <div className="table-row" key={item.id} data-lot-id={item.id}>
                  <span><b>{item.instrumentName}</b></span>
                  <span>{dateText(item.purchasedAt)}</span>
                  <span>{item.quantity}</span>
                  <span>{money(item.unitPrice)}</span>
                  <strong>{money(item.costBasis)}</strong>
                  <span className="row-actions">
                    <button
                      type="button"
                      data-edit-lot={item.id}
                      disabled={busy || pendingAction !== null}
                      onClick={() => setDialog({ type: "lot", item })}
                    >
                      Düzenle
                    </button>
                    <button
                      type="button"
                      className="danger-link"
                      data-delete-lot={item.id}
                      disabled={busy || pendingAction !== null}
                      onClick={() => deleteLot(item)}
                    >
                      {deleting ? "İşleniyor…" : "Sil"}
                    </button>
                  </span>
                </div>
              );
            })
          )}
        </div>
      </article>

      {dialog?.type === "lot" ? (
        <LotDialog
          key={`lot:${dialog.item?.id ?? "new"}`}
          accounts={accounts}
          instruments={instruments}
          lot={dialog.item}
          onClose={() => setDialog(null)}
          onCreate={onCreateLot}
          onUpdate={onUpdateLot}
        />
      ) : null}
      {dialog?.type === "sale" ? (
        <SaleDialog
          key={`sale:${dialog.item?.id ?? "new"}`}
          accounts={accounts}
          instruments={instruments}
          portfolio={portfolio}
          sale={dialog.item}
          onClose={() => setDialog(null)}
          onCreate={onCreateSale}
          onUpdate={onUpdateSale}
        />
      ) : null}
    </section>
  );
}

/** Route-compatible name retained for the existing `#/savings` URL. */
export const SavingsPage = InvestmentsPage;
