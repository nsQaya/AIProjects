import { useEffect, useState } from "react";
import type { InvestmentValueSeriesItemDTO } from "@defterx/contracts";

import { cashFlowWindow, type CashFlowRange } from "../../finance";
import { SavingsPage } from "../../modules/investments";
import { useFinance } from "../../providers/FinanceProvider";

export function InvestmentsRoute() {
  const { mutate, mutationBusy, service, snapshot } = useFinance();
  const [valueHistoryRange, setValueHistoryRange] = useState<CashFlowRange>("1Y");
  const [valueHistory, setValueHistory] = useState<readonly InvestmentValueSeriesItemDTO[]>([]);
  const [valueHistoryBusy, setValueHistoryBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const window = cashFlowWindow(valueHistoryRange, new Date());
    Promise.resolve()
      .then(() => {
        if (cancelled) return undefined;
        setValueHistoryBusy(true);
        // Always daily: unlike the dashboard's cash-flow chart, this chart
        // should stay fine-grained at every date range so the line reads
        // like a price chart (fintables-style) instead of coarsening into
        // weekly/monthly/yearly steps for longer windows.
        return service.loadInvestmentValueSeries({
          from: window.from,
          to: window.to,
          granularity: "day",
        });
      })
      .then((series) => {
        if (!cancelled && series) setValueHistory(series);
      })
      .catch(() => {
        if (!cancelled) setValueHistory([]);
      })
      .finally(() => {
        if (!cancelled) setValueHistoryBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [service, valueHistoryRange]);

  return (
    <SavingsPage
      accounts={snapshot.accounts}
      instruments={snapshot.instruments}
      lots={snapshot.lots}
      portfolio={snapshot.portfolio}
      sales={snapshot.sales}
      busy={mutationBusy}
      valueHistory={valueHistory}
      valueHistoryBusy={valueHistoryBusy}
      valueHistoryRange={valueHistoryRange}
      onValueHistoryRangeChange={setValueHistoryRange}
      onCreateLot={(values) =>
        mutate(() => service.createLot(values), "Birikim alımı eklendi.")
      }
      onUpdateLot={(id, values) =>
        mutate(() => service.updateLot(id, values), "Birikim alımı güncellendi.")
      }
      onDeleteLot={(id, version) =>
        mutate(() => service.deleteLot(id, version), "Birikim alımı silindi.")
      }
      onCreateSale={(values) =>
        mutate(
          () => service.createSale(values),
          "Birikim satışı kaydedildi ve bedel seçilen hesaba aktarıldı.",
        )
      }
      onUpdateSale={(id, values) =>
        mutate(
          () => service.updateSale(id, values),
          "Birikim satışı ve bağlı hesap hareketi güncellendi.",
        )
      }
      onDeleteSale={(id, version) =>
        mutate(
          () => service.deleteSale(id, version),
          "Birikim satışı silindi ve hesap hareketi ters kayıtla geri alındı.",
        )
      }
    />
  );
}
