import { useState, type CSSProperties } from "react";
import type { InvestmentValueSeriesItemDTO } from "@defterx/contracts";

import { ReportChart } from "../../components/charts";
import { Button, InlineFeedback } from "../../components/ui";
import type { CashFlowRange } from "../../finance";
import { errorMessage } from "../../lib/error-message";
import { dateText, money, moneyInCurrency, toNumber } from "../../lib/format";
import { FxConversionDialog } from "../fx";
import { summarizeAccountPortfolio, type AccountPortfolioGroup } from "./account-portfolio";
import { isPositiveDecimal } from "./decimal";
import { investmentValueHistoryOption } from "./investment-chart-options";
import { CapitalIncreaseDialog, LotDialog, SaleDialog } from "./InvestmentDialogs";
import type {
  InvestmentLotViewModel,
  InvestmentPageCallbacks,
  InvestmentPortfolioViewModel,
  InvestmentsPageModel,
  InvestmentSaleViewModel,
} from "./investment-types";

type InvestmentDialogState =
  | { readonly type: "lot"; readonly item: InvestmentLotViewModel | null }
  | { readonly type: "sale"; readonly item: InvestmentSaleViewModel | null }
  | { readonly type: "capital" }
  | { readonly type: "fx"; readonly mode: "buy" | "sell" };

const valueHistoryRangeLabels: Readonly<Record<CashFlowRange, string>> = {
  "1M": "1 ay",
  "3M": "3 ay",
  "6M": "6 ay",
  YTD: "Yıl başı",
  "1Y": "1 yıl",
  "5Y": "5 yıl",
  "10Y": "10 yıl",
};

const valueHistoryRangeOrder = Object.keys(valueHistoryRangeLabels) as CashFlowRange[];

export interface InvestmentsPageProps extends InvestmentPageCallbacks, InvestmentsPageModel {
  busy?: boolean;
  confirmDeleteLot?: (lot: InvestmentLotViewModel) => boolean | Promise<boolean>;
  confirmDeleteSale?: (sale: InvestmentSaleViewModel, message: string) => boolean | Promise<boolean>;
  onValueHistoryRangeChange?: (range: CashFlowRange) => void;
  valueHistory?: readonly InvestmentValueSeriesItemDTO[];
  valueHistoryBusy?: boolean;
  valueHistoryRange?: CashFlowRange;
}

export function InvestmentsPage({
  accounts,
  brokerageAccounts,
  busy = false,
  confirmDeleteLot = () => globalThis.confirm("Bu birikim alımı silinsin mi?"),
  confirmDeleteSale = (_sale, message) => globalThis.confirm(message),
  fxAccounts,
  instruments,
  lots,
  onCreateCapitalIncrease,
  onCreateFxConversion,
  onCreateLot,
  onCreateSale,
  onDeleteLot,
  onDeleteSale,
  onUpdateLot,
  onUpdateSale,
  onValueHistoryRangeChange,
  portfolio,
  sales,
  valueHistory = [],
  valueHistoryBusy = false,
  valueHistoryRange = "1Y",
}: InvestmentsPageProps) {
  const [dialog, setDialog] = useState<InvestmentDialogState | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  // costBasisTRY/currentValueTRY are already normalized to TRY (equal to the
  // plain fields for TRY instruments); a foreign-currency instrument with no
  // TCMB rate yet contributes 0 here rather than mixing units into the total.
  const summary = summarizeAccountPortfolio(portfolio, lots, brokerageAccounts);
  const cost = summary.positionsCost;
  const value = summary.positionsValue;
  const gain = value - cost;
  // Total savings = brokerage cash still parked at custodians + open position value.
  const netWorth = value + summary.totalCash;
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
          <p className="eyebrow">Toplam birikim varlığı</p>
          <h2>{money(netWorth)}</h2>
          <span>
            Nakit {money(summary.totalCash)} · Pozisyon {money(value)} · Maliyet {money(cost)} ·
            Gerçekleşmemiş{" "}
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
            id="open-fx-buy-dialog"
            variant="secondary"
            disabled={busy}
            onClick={() => setDialog({ type: "fx", mode: "buy" })}
          >
            + Döviz al
          </Button>
          <Button
            id="open-fx-sell-dialog"
            variant="secondary"
            disabled={busy}
            onClick={() => setDialog({ type: "fx", mode: "sell" })}
          >
            Döviz sat
          </Button>
          <Button
            id="open-sale-dialog"
            variant="secondary"
            disabled={busy || !canCreateSale}
            onClick={() => setDialog({ type: "sale", item: null })}
          >
            Birikim sat
          </Button>
          <Button
            id="open-capital-increase-dialog"
            variant="secondary"
            disabled={busy || !canCreateSale}
            onClick={() => setDialog({ type: "capital" })}
          >
            + Sermaye artırımı
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

      <article className="panel report-main-panel">
        <header className="panel-head">
          <div>
            <h2>Portföy Değeri Gelişimi</h2>
            <p>Seçilen dönemdeki yatırım pozisyonlarının dönem sonu toplam değeri</p>
          </div>
          <div className="range-switch" role="group" aria-label="Tarih aralığı">
            {valueHistoryRangeOrder.map((option) => (
              <button
                key={option}
                type="button"
                data-range-value={option}
                className={valueHistoryRange === option ? "active" : ""}
                aria-pressed={valueHistoryRange === option}
                disabled={busy || valueHistoryBusy}
                onClick={() => onValueHistoryRangeChange?.(option)}
              >
                {valueHistoryRangeLabels[option]}
              </button>
            ))}
          </div>
        </header>
        {valueHistory.length === 0 ? (
          <div className="empty-state">Seçilen dönemde yatırım değeri verisi yok.</div>
        ) : (
          <ReportChart
            busy={busy || valueHistoryBusy}
            height={330}
            label="Portföy değeri gelişimi"
            option={investmentValueHistoryOption(valueHistory)}
          />
        )}
      </article>

      {brokerageAccounts.length === 0 && portfolio.length === 0 ? (
        <article className="panel">
          <header className="panel-head">
            <div>
              <h2>Aracı kurum hesapları</h2>
              <p>Piapiri, Binance, BES gibi kurumlara aktardığın, henüz yatırıma dönüşmemiş nakit</p>
            </div>
          </header>
          <div className="empty-state">
            Henüz aracı kurum hesabın yok. Hesaplar sayfasından “Birikim” türünde bir hesap
            açıp para aktardığında burada görünür.
          </div>
        </article>
      ) : (
        summary.groups.map((group) => (
          <AccountSection key={group.accountId ?? "unlinked"} group={group} />
        ))
      )}

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
                  <span>{moneyInCurrency(item.unitPrice, item.currencyCode)}</span>
                  <span>{item.destinationAccountName}</span>
                  <strong className={toNumber(item.gain) < 0 ? "expense" : "income"}>
                    {toNumber(item.gain) >= 0 ? "+" : ""}{moneyInCurrency(item.gain, item.currencyCode)}
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
            <h2>Alımlar ve sermaye artışları</h2>
            <p>Alış fiyatı, adet ve bedelsiz / bedelli artışlar</p>
          </div>
        </header>
        <div className="transaction-table investment-table">
          <div className="table-head">
            <span>Varlık</span><span>Tarih</span><span>Adet</span>
            <span>Birim fiyat</span><span>Maliyet</span><span>Hesap</span><span>İşlemler</span>
          </div>
          {lots.length === 0 ? (
            <div className="empty-state">Henüz birikim alımı yok.</div>
          ) : (
            lots.map((item) => {
              const deleting = pendingAction === `lot:${item.id}`;
              const capitalIncrease = item.kind === "CAPITAL_INCREASE";
              const kindLabel = capitalIncrease
                ? isPositiveDecimal(item.costBasis)
                  ? "Bedelli"
                  : "Bedelsiz"
                : null;
              return (
                <div className="table-row" key={item.id} data-lot-id={item.id}>
                  <span>
                    <b>{item.instrumentName}</b>
                    {kindLabel ? <small className="lot-kind"> · {kindLabel}</small> : null}
                  </span>
                  <span>{dateText(item.purchasedAt)}</span>
                  <span>{item.quantity}</span>
                  <span>{moneyInCurrency(item.unitPrice, item.currencyCode)}</span>
                  <strong>{moneyInCurrency(item.costBasis, item.currencyCode)}</strong>
                  <span className="lot-account">
                    {item.accountName ?? "—"}
                    {item.accountName && !item.posted ? <small>nakit bağlı değil</small> : null}
                  </span>
                  <span className="row-actions">
                    {capitalIncrease ? null : (
                      <button
                        type="button"
                        data-edit-lot={item.id}
                        disabled={busy || pendingAction !== null}
                        onClick={() => setDialog({ type: "lot", item })}
                      >
                        Düzenle
                      </button>
                    )}
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
      {dialog?.type === "capital" ? (
        <CapitalIncreaseDialog
          accounts={accounts}
          instruments={instruments}
          portfolio={portfolio}
          onClose={() => setDialog(null)}
          onCreate={onCreateCapitalIncrease}
        />
      ) : null}
      {dialog?.type === "fx" ? (
        <FxConversionDialog
          accounts={fxAccounts}
          initialMode={dialog.mode}
          onClose={() => setDialog(null)}
          onSubmit={onCreateFxConversion}
        />
      ) : null}
    </section>
  );
}

/**
 * A brokerage account (or the "Bağlanmamış" bucket) with the positions funded
 * through it. Collapsed by default: the summary line (cash, positions value,
 * cost and total) stays visible; expanding reveals the position cards.
 */
function AccountSection({ group }: { group: AccountPortfolioGroup }) {
  const figures = group.accountId
    ? `Nakit ${moneyInCurrency(group.cash ?? "0", group.currencyCode ?? "TRY")} · Yatırımda ${money(
        group.positionsValue,
      )} · Maliyet ${money(group.positionsCost)}`
    : `Bir aracı kurum hesabına bağlı değil · Yatırımda ${money(group.positionsValue)} · Maliyet ${money(
        group.positionsCost,
      )}`;

  return (
    <details className="panel account-section" data-account-group={group.accountId ?? "unlinked"}>
      <summary>
        <div className="account-section-headline">
          <h2>{group.name}{group.isArchived ? " · Arşivli" : ""}</h2>
          {group.total !== null ? (
            <strong className="account-section-total">{money(group.total)}</strong>
          ) : null}
        </div>
        <p className="account-section-figures">{figures}</p>
      </summary>
      {group.positions.length === 0 ? (
        <div className="empty-state">Bu hesaptan alınmış açık pozisyon yok.</div>
      ) : (
        <div className="account-grid">
          {group.positions.map((item) => (
            <PortfolioPositionCard key={item.instrumentId} item={item} />
          ))}
        </div>
      )}
    </details>
  );
}

function PortfolioPositionCard({ item }: { item: InvestmentPortfolioViewModel }) {
  const itemGain = toNumber(item.gain);
  const quantity = toNumber(item.quantity);
  const averageCost = quantity === 0 ? 0 : toNumber(item.costBasis) / quantity;
  const style = {
    "--account": itemGain < 0 ? "#ad5048" : "#287b60",
  } as CSSProperties;

  return (
    <article className="account-card" style={style}>
      <div className="account-top">
        <span className="account-symbol" aria-hidden="true">◇</span>
        <small>{item.assetTypeName}</small>
      </div>
      <div>
        <small>{item.symbol || item.currencyCode}</small>
        <h3>{item.name}</h3>
      </div>
      <strong>{moneyInCurrency(item.currentValue ?? item.costBasis, item.currencyCode)}</strong>
      {item.currencyCode !== "TRY" ? (
        <small>
          {item.currentValueTRY !== null
            ? `≈ ${money(item.currentValueTRY)}`
            : "TL karşılığı için kur bekleniyor"}
        </small>
      ) : null}
      <small>{item.quantity} adet · Ort. maliyet {moneyInCurrency(averageCost, item.currencyCode)}</small>
      <b className={itemGain < 0 ? "expense" : "income"}>
        {item.latestPrice !== null ? (
          <>
            Son fiyat {moneyInCurrency(item.latestPrice, item.currencyCode)}
            {item.latestPriceAt ? ` · ${dateText(item.latestPriceAt)}` : ""}
            {" · "}{itemGain >= 0 ? "+" : ""}{moneyInCurrency(item.gain ?? "0", item.currencyCode)}
            {item.gainPercent !== null ? ` (%${toNumber(item.gainPercent).toFixed(2)})` : ""}
          </>
        ) : (
          "Son fiyat bekleniyor"
        )}
      </b>
    </article>
  );
}

/** Route-compatible name retained for the existing `#/savings` URL. */
export const SavingsPage = InvestmentsPage;
