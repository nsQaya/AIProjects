import { useMemo, useState, type CSSProperties } from "react";
import type {
  IncomeExpenseCostCenterItemDTO,
  IncomeExpenseReportItemDTO,
  ReportAnalyticsResponse,
} from "@defterx/contracts";

import { ReportChart } from "../../components/charts";
import { ExportMenu } from "../../components/ui";
import type { AccountView } from "../../finance";
import type { ReportRange } from "../../finance/finance-state";
import { today } from "../../lib/date";
import { money, moneyInCurrency, toNumber } from "../../lib/format";
import { exportTableToExcel, exportTableToPdf, type ExportTable } from "../../lib/table-export";
import { ReportFilters } from "./ReportFilters";
import {
  accountBalanceOption,
  categoryDistributionOption,
  costCenterDistributionOption,
  liquidityOption,
  netWorthBreakdown,
  netWorthTreemapOption,
  reportChartColors,
  trendOption,
} from "./report-chart-options";
import {
  accountBalancesTable,
  categoryDetailTable,
  liquidityEventsTable,
  netWorthPerformanceTable,
  reportDate,
  reportPeriodMeta,
} from "./report-export";

export type ReportCategoryItem = Pick<
  IncomeExpenseReportItemDTO,
  "amount" | "id" | "isActive" | "name" | "type"
>;

export interface ReportsPageProps {
  accounts?: readonly AccountView[];
  analytics?: ReportAnalyticsResponse | null;
  busy?: boolean;
  /** Geçiş döneminde eski rapor çağrılarının görünümünü korur. */
  costCenters?: readonly IncomeExpenseCostCenterItemDTO[];
  /** Geçiş döneminde eski rapor çağrılarının görünümünü korur. */
  items?: readonly ReportCategoryItem[];
  loadFailed?: boolean;
  onFilterChange?: (filter: ReportRange) => Promise<unknown>;
  onNotify?: (message: string) => void;
  range?: ReportRange;
}

type ReportKey = "trend" | "balances" | "categories" | "liquidity" | "netWorth";

const tabs: ReadonlyArray<{ key: ReportKey; label: string }> = [
  { key: "trend", label: "Gelir · Gider · Net" },
  { key: "balances", label: "Hesap bakiyeleri" },
  { key: "categories", label: "Kategori detayı" },
  { key: "liquidity", label: "Likidite tahmini" },
  { key: "netWorth", label: "Varlık ve yatırım" },
];

function sum(values: readonly string[]): number {
  return values.reduce((total, value) => total + Number(value), 0);
}

export function ReportsPage({
  accounts = [],
  analytics = null,
  busy = false,
  costCenters = [],
  items = [],
  loadFailed = false,
  onFilterChange = () => Promise.resolve(),
  onNotify = () => {},
  range = {},
}: ReportsPageProps) {
  const [active, setActive] = useState<ReportKey>("trend");
  const [detailCategoryId, setDetailCategoryId] = useState("");
  const [detailCostCenterId, setDetailCostCenterId] = useState("");

  const analyticsCategories = useMemo(() => {
    const grouped = new Map<string, ReportCategoryItem>();
    for (const row of analytics?.categoryDetail.breakdown ?? []) {
      const current = grouped.get(row.categoryId);
      grouped.set(row.categoryId, {
        id: row.categoryId,
        name: row.categoryName,
        type: row.categoryType,
        isActive: true,
        amount: String(Number(current?.amount ?? 0) + Number(row.amount)),
      });
    }
    return [...grouped.values()];
  }, [analytics]);
  const categoryItems = analytics ? analyticsCategories : items;
  const expenseRows = categoryItems
    .filter((item) => item.type === "EXPENSE" && Number(item.amount) > 0)
    .map((item) => ({ ...item, amount: Number(item.amount) }))
    .sort((left, right) => right.amount - left.amount);
  const totalExpense = expenseRows.reduce((total, item) => total + item.amount, 0);
  const totalIncome = categoryItems
    .filter((item) => item.type === "INCOME")
    .reduce((total, item) => total + Number(item.amount), 0);
  const savingsRate = totalIncome ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0;

  const analyticsCostCenters = useMemo(() => {
    const grouped = new Map<string, { amount: number; id: string; isActive: boolean; name: string }>();
    for (const row of analytics?.categoryDetail.breakdown ?? []) {
      if (!row.costCenterId || !row.costCenterName || row.categoryType !== "EXPENSE") continue;
      const current = grouped.get(row.costCenterId);
      grouped.set(row.costCenterId, {
        id: row.costCenterId,
        name: row.costCenterName,
        isActive: true,
        amount: (current?.amount ?? 0) + Number(row.amount),
      });
    }
    return [...grouped.values()];
  }, [analytics]);
  const costCenterRows = analytics
    ? analyticsCostCenters.sort((left, right) => right.amount - left.amount)
    : costCenters
      .filter((item) => Number(item.amount) < 0)
      .map((item) => ({ ...item, amount: -Number(item.amount) }))
      .sort((left, right) => right.amount - left.amount);
  const totalCostCenterExpense = costCenterRows.reduce((total, item) => total + item.amount, 0);
  const detailTransactions = (analytics?.categoryDetail.transactions ?? []).filter((transaction) =>
    (!detailCategoryId || transaction.categoryId === detailCategoryId)
    && (!detailCostCenterId || transaction.costCenterId === detailCostCenterId));

  const netWorthTree = useMemo(
    () => (analytics ? netWorthBreakdown(analytics.netWorth) : { nodes: [], charted: 0, debt: 0 }),
    [analytics],
  );

  const exportMeta = useMemo(() => {
    if (!analytics) return [];
    const selected = range.accountIds;
    const accountSummary = !selected || selected.length >= accounts.length
      ? "Tüm hesaplar"
      : `${selected.length} hesap: ${accounts
          .filter((account) => selected.includes(account.id))
          .map((account) => account.name)
          .join(", ")}`;
    return reportPeriodMeta(analytics.from, analytics.to, accountSummary);
  }, [accounts, analytics, range.accountIds]);

  const exportActions = (table: ExportTable, filenameBase: string) => ({
    onExcel: () => exportTableToExcel(table, `${filenameBase}-${today()}`),
    onPdf: () => {
      if (!exportTableToPdf(table)) onNotify("PDF için tarayıcı açılır pencere iznini verin.");
    },
  });

  const boundedRate = Math.max(0, Math.min(100, savingsRate));
  const scoreStyle: CSSProperties = {
    background: `radial-gradient(closest-side,#f5f8f6 78%,transparent 79% 100%),conic-gradient(var(--forest-700) ${boundedRate}%,#dce7e1 0)`,
  };

  return (
    <section className="page-section reports-workspace">
      <ReportFilters accounts={accounts} busy={busy} value={range} onApply={onFilterChange} />

      <nav className="report-tabs" aria-label="Raporlar">
        {tabs.map((tab) => (
          <button key={tab.key} type="button" className={active === tab.key ? "active" : ""}
            aria-current={active === tab.key ? "page" : undefined} onClick={() => setActive(tab.key)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {!analytics && items.length === 0 && costCenters.length === 0 ? (
        <article className="panel empty-state">
          {loadFailed
            ? "Rapor verileri yüklenemedi. Filtreleri kontrol edip Raporu uygula ile yeniden deneyin."
            : "Rapor verileri hazırlanıyor."}
        </article>
      ) : null}

      {active === "trend" && analytics ? (
        <>
          <div className="report-metrics">
            <article><span>Gelir</span><strong>{money(sum(analytics.trend.map((item) => item.income)))}</strong></article>
            <article><span>Gider</span><strong>{money(sum(analytics.trend.map((item) => item.expense)))}</strong></article>
            <article><span>Net</span><strong>{money(sum(analytics.trend.map((item) => item.net)))}</strong></article>
            <article><span>Dönem sonu bakiye</span><strong>{money(Number(analytics.trend.at(-1)?.balance ?? 0))}</strong></article>
          </div>
          <article className="panel report-main-panel">
            <header className="panel-head"><div><h2>Gelir–Gider–Net Trendi</h2><p>Dönemsel hareket ve seçili hesapların birleşik bakiyesi</p></div></header>
            <ReportChart busy={busy} height={390} label="Gelir gider net trendi" option={trendOption(analytics.trend)} />
          </article>
        </>
      ) : null}

      {active === "balances" && analytics ? (
        <article className="panel report-main-panel">
          <header className="panel-head">
            <div><h2>Hesap Bakiyesi Gelişimi</h2><p>Her hesabın dönem sonu bakiyesi ayrı çizgide gösterilir</p></div>
            {analytics.accountBalances.accounts.length > 0 ? (
              <ExportMenu {...exportActions(accountBalancesTable(analytics.accountBalances, exportMeta), "defterx-hesap-bakiyeleri")} />
            ) : null}
          </header>
          <ReportChart busy={busy} height={410} label="Hesap bakiyesi gelişimi" option={accountBalanceOption(analytics.accountBalances)} />
          <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Hesap</th><th>Son bakiye</th></tr></thead><tbody>
            {analytics.accountBalances.accounts.map((account) => {
              const latest = analytics.accountBalances.items.filter((item) => item.accountId === account.id).at(-1);
              return <tr key={account.id}><td>{account.name}</td><td>{money(Number(latest?.balance ?? 0))}</td></tr>;
            })}
          </tbody></table></div>
        </article>
      ) : null}

      {active === "categories" ? (
        <>
          <div className="report-grid">
            <article className="panel">
              <header className="panel-head"><div><h2>Kategori dağılımı</h2><p>Seçilen tarih ve hesapların gider kayıtları</p></div></header>
              <div className="distribution-layout">
                <ReportChart busy={busy} height={250} label="Kategori bazında gider dağılımı" option={categoryDistributionOption(expenseRows, totalExpense)} />
                <div className="report-legend">
                  {expenseRows.map((row, index) => (
                    <div key={row.id} data-report-category={row.id}>
                      <i aria-hidden="true" style={{ "--dot": reportChartColors[index % reportChartColors.length] } as CSSProperties} />
                      <span>{row.name}{row.isActive ? "" : " (pasif)"}</span>
                      <b>%{totalExpense ? Math.round((row.amount / totalExpense) * 100) : 0}</b>
                      <strong>{money(row.amount)}</strong>
                    </div>
                  ))}
                  {expenseRows.length === 0 ? <div className="empty-state">Seçilen filtrelerde gider kaydı yok.</div> : null}
                </div>
              </div>
            </article>
            <article className="panel savings-card">
              <span>Seçili dönem net / gelir</span><strong>%{savingsRate}</strong>
              <div className="score-ring" style={scoreStyle}><b>{savingsRate}</b><small>/100</small></div>
              <p>Oran filtrelenmiş gelir ve gider toplamlarından hesaplanır.</p>
            </article>
          </div>
          <article className="panel cost-center-report">
            <header className="panel-head"><div><h2>Masraf merkezi dağılımı</h2><p>Masraf merkezi atanmış giderler</p></div><strong>{money(totalCostCenterExpense)}</strong></header>
            {costCenterRows.length > 0 ? <ReportChart busy={busy} height={Math.max(220, costCenterRows.length * 42)} label="Masraf merkezi bazında gider dağılımı" option={costCenterDistributionOption(costCenterRows)} /> : null}
            <div className="report-legend cost-center-legend">
              {costCenterRows.map((row, index) => (
                <div key={row.id} data-report-cost-center={row.id}>
                  <i aria-hidden="true" style={{ "--dot": reportChartColors[index % reportChartColors.length] } as CSSProperties} />
                  <span>{row.name}{row.isActive ? "" : " (pasif)"}</span>
                  <b>%{totalCostCenterExpense ? Math.round((row.amount / totalCostCenterExpense) * 100) : 0}</b>
                  <strong>{money(row.amount)}</strong>
                </div>
              ))}
            </div>
          </article>
          {analytics ? (
            <article className="panel report-detail-panel">
              <header className="panel-head">
                <div><h2>Kategori → Masraf Merkezi → İşlem</h2><p>Bir kırılım seçerek kaynak işlemlere inin</p></div>
                {detailTransactions.length > 0 ? (
                  <ExportMenu {...exportActions(categoryDetailTable(detailTransactions, exportMeta), "defterx-kategori-detayi")} />
                ) : null}
              </header>
              <div className="report-drill-filters">
                <label><span>Kategori</span><select value={detailCategoryId} onChange={(event) => setDetailCategoryId(event.target.value)}><option value="">Tüm kategoriler</option>{analyticsCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
                <label><span>Masraf merkezi</span><select value={detailCostCenterId} onChange={(event) => setDetailCostCenterId(event.target.value)}><option value="">Tüm merkezler</option>{costCenterRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
              </div>
              <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Tarih</th><th>İşlem</th><th>Kategori</th><th>Masraf merkezi</th><th>Hesap</th><th>Tutar</th></tr></thead><tbody>
                {detailTransactions.map((transaction) => <tr key={transaction.id}><td>{reportDate(transaction.transactionDate)}</td><td>{transaction.title}</td><td>{transaction.categoryName ?? "—"}</td><td>{transaction.costCenterName ?? "—"}</td><td>{transaction.accountName ?? "—"}</td><td>{money(Number(transaction.amount))}</td></tr>)}
                {detailTransactions.length === 0 ? <tr><td colSpan={6}>Seçilen kırılımda işlem yok.</td></tr> : null}
              </tbody></table></div>
            </article>
          ) : null}
        </>
      ) : null}

      {active === "liquidity" && analytics ? (
        <>
          <div className="report-metrics">
            <article><span>Başlangıç bakiyesi</span><strong>{money(Number(analytics.liquidity.openingBalance))}</strong></article>
            <article><span>Giriş</span><strong>{money(sum(analytics.liquidity.items.map((item) => item.inflow)))}</strong></article>
            <article><span>Çıkış</span><strong>{money(sum(analytics.liquidity.items.map((item) => item.outflow)))}</strong></article>
            <article><span>Tahmini dönem sonu</span><strong>{money(Number(analytics.liquidity.items.at(-1)?.projectedBalance ?? analytics.liquidity.openingBalance))}</strong></article>
          </div>
          <article className="panel report-main-panel">
            <header className="panel-head">
              <div><h2>Likidite ve Nakit Tahmini</h2><p>Başlangıç bakiyesi, gerçekleşen işlemler ve bekleyen planlı işlemlerin birleşik projeksiyonu</p></div>
              {analytics.liquidity.events.length > 0 ? (
                <ExportMenu {...exportActions(liquidityEventsTable(analytics.liquidity, exportMeta), "defterx-likidite-planlar")} />
              ) : null}
            </header>
            <ReportChart busy={busy} height={390} label="Likidite ve nakit tahmini" option={liquidityOption(analytics.liquidity.items)} />
            <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Tarih</th><th>Planlı işlem</th><th>Tür</th><th>Etki</th></tr></thead><tbody>
              {analytics.liquidity.events.map((event) => <tr key={event.id}><td>{reportDate(event.scheduledAt)}</td><td>{event.title}</td><td>{event.type}</td><td className={Number(event.impact) >= 0 ? "positive" : "negative"}>{money(Number(event.impact))}</td></tr>)}
              {analytics.liquidity.events.length === 0 ? <tr><td colSpan={4}>Seçilen tarihlerde bekleyen planlı işlem yok.</td></tr> : null}
            </tbody></table></div>
          </article>
        </>
      ) : null}

      {active === "netWorth" && analytics ? (
        <>
          <div className="report-metrics">
            <article><span>Toplam varlık</span><strong>{money(Number(analytics.netWorth.totalAssets))}</strong></article>
            <article><span>Yatırım maliyeti</span><strong>{money(Number(analytics.netWorth.investmentCost))}</strong></article>
            <article><span>Gerçekleşen getiri</span><strong>{money(Number(analytics.netWorth.realizedGain))}</strong></article>
            <article><span>Gerçekleşmemiş getiri</span><strong>{money(Number(analytics.netWorth.unrealizedGain))}</strong></article>
            <article style={{padding: "12px 14px"}}><span>Toplam</span><strong style={{fontSize: "15px"}}>{money(Number(analytics.netWorth.investmentCost) + Number(analytics.netWorth.unrealizedGain))}</strong></article>
          </div>
          <article className="panel net-worth-treemap-panel">
            <header className="panel-head"><div>
              <h2>Varlık Dağılımı</h2>
              <p>Görünen varlık <b>{money(netWorthTree.charted)}</b> · nakit ve yatırımlar tür → hesap / enstrüman kırılımında; bir bloğa tıklayıp inin, üstteki yoldan geri dönün</p>
            </div></header>
            {netWorthTree.nodes.length > 0 ? (
              <ReportChart busy={busy} height={430} label="Varlık dağılımı ağacı" option={netWorthTreemapOption(analytics.netWorth)} />
            ) : (
              <div className="empty-state">Seçilen kapsamda nakit veya yatırım varlığı yok.</div>
            )}
            {netWorthTree.debt < 0 ? (
              <p className="report-net-worth-note">
                Eksi bakiye / kredi kartı borcu <b className="negative">{money(netWorthTree.debt)}</b> grafiğe dahil değildir.
              </p>
            ) : null}
          </article>
          <article className="panel report-main-panel">
            <header className="panel-head">
              <div><h2>Yatırım Performansı</h2><p>Bitiş tarihindeki pozisyon ve seçili dönemde gerçekleşen getiri</p></div>
              {analytics.netWorth.items.length > 0 ? (
                <ExportMenu {...exportActions(netWorthPerformanceTable(analytics.netWorth, exportMeta), "defterx-yatirim-performansi")} />
              ) : null}
            </header>
              <div className="report-table-wrap"><table className="report-table"><thead><tr><th>Varlık</th><th>Döviz</th><th>Maliyet</th><th>Güncel değer</th><th>Gerçekleşen</th><th>Gerçekleşmemiş</th><th>Toplam</th></tr></thead><tbody>
                {analytics.netWorth.items.map((item) => {
                  const foreign = item.currencyCode !== "TRY";
                  const unrealizedGainValue = item.unrealizedGain === null ? 0 : toNumber(item.unrealizedGain);
                  const totalValue = toNumber(item.costBasis) + unrealizedGainValue;
                  const totalValueTRY = (item.costBasisTRY === null || (item.unrealizedGain !== null && item.unrealizedGainTRY === null))
                    ? null
                    : toNumber(item.costBasisTRY ?? "0") + toNumber(item.unrealizedGainTRY ?? "0");
                  return (
                    <tr key={item.instrumentId}>
                      <td><b>{item.name}</b><small>{item.symbol ?? item.assetTypeName}</small></td>
                      <td>{item.currencyCode}</td>
                      <td>
                        {moneyInCurrency(item.costBasis, item.currencyCode)}
                        {foreign ? <small>{item.costBasisTRY !== null ? `≈ ${money(item.costBasisTRY)}` : "TL karşılığı için kur bekleniyor"}</small> : null}
                      </td>
                      <td>
                        {item.currentValue === null ? "Fiyat yok" : moneyInCurrency(item.currentValue, item.currencyCode)}
                        {foreign && item.currentValue !== null ? <small>{item.currentValueTRY !== null ? `≈ ${money(item.currentValueTRY)}` : "TL karşılığı için kur bekleniyor"}</small> : null}
                      </td>
                      <td>
                        {moneyInCurrency(item.realizedGain, item.currencyCode)}
                        {foreign ? <small>{item.realizedGainTRY !== null ? `≈ ${money(item.realizedGainTRY)}` : "TL karşılığı için kur bekleniyor"}</small> : null}
                      </td>
                      <td>
                        {item.unrealizedGain === null ? "—" : moneyInCurrency(item.unrealizedGain, item.currencyCode)}
                        {foreign && item.unrealizedGain !== null ? <small>{item.unrealizedGainTRY !== null ? `≈ ${money(item.unrealizedGainTRY)}` : "TL karşılığı için kur bekleniyor"}</small> : null}
                      </td>
                      <td>
                        {moneyInCurrency(totalValue, item.currencyCode)}
                        {foreign ? <small>{totalValueTRY !== null ? `≈ ${money(totalValueTRY)}` : "TL karşılığı için kur bekleniyor"}</small> : null}
                      </td>
                    </tr>
                  );
                })}
                {analytics.netWorth.items.length === 0 ? <tr><td colSpan={7}>Seçilen kapsamda yatırım kaydı yok.</td></tr> : null}
                {analytics.netWorth.items.length > 0 ? (
                  <tr style={{fontWeight: "bold", backgroundColor: "var(--background-secondary)"}}>
                    <td colSpan={2}>TOPLAM</td>
                    <td>{money(Number(analytics.netWorth.investmentCost))}</td>
                    <td>{money(Number(analytics.netWorth.investmentValue))}</td>
                    <td>{money(Number(analytics.netWorth.realizedGain))}</td>
                    <td>{money(Number(analytics.netWorth.unrealizedGain))}</td>
                    <td>{money(Number(analytics.netWorth.investmentCost) + Number(analytics.netWorth.unrealizedGain))}</td>
                  </tr>
                ) : null}
              </tbody></table></div>
            </article>
        </>
      ) : null}
    </section>
  );
}
