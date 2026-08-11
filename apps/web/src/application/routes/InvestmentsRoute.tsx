import { SavingsPage } from "../../modules/investments";
import { useFinance } from "../../providers/FinanceProvider";

export function InvestmentsRoute() {
  const { mutate, mutationBusy, service, snapshot } = useFinance();

  return (
    <SavingsPage
      accounts={snapshot.accounts}
      instruments={snapshot.instruments}
      lots={snapshot.lots}
      portfolio={snapshot.portfolio}
      sales={snapshot.sales}
      busy={mutationBusy}
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
