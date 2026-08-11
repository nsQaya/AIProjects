import { useState, type FormEvent } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogFeedback,
  DialogHeader,
} from "../../components/ui";
import { isoAtLocalNoon, isoDay, today } from "../../lib/date";
import { errorMessage } from "../../lib/error-message";
import { positiveDecimalString } from "./decimal";
import type {
  InvestmentAccountOption,
  InvestmentInstrumentOption,
  InvestmentLotValues,
  InvestmentLotViewModel,
  InvestmentPortfolioViewModel,
  InvestmentSaleValues,
  InvestmentSaleViewModel,
  UpdateInvestmentLotValues,
  UpdateInvestmentSaleValues,
} from "./investment-types";

function formString(values: FormData, name: string): string {
  const value = values.get(name);
  return typeof value === "string" ? value : "";
}

function uniqueById<T extends { readonly id: string }>(items: readonly T[]): readonly T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

interface InvestmentDialogBaseProps {
  accounts: readonly InvestmentAccountOption[];
  instruments: readonly InvestmentInstrumentOption[];
  onClose: () => void;
}

export interface LotDialogProps extends InvestmentDialogBaseProps {
  lot: InvestmentLotViewModel | null;
  onCreate: (values: InvestmentLotValues) => Promise<unknown>;
  onUpdate: (id: string, values: UpdateInvestmentLotValues) => Promise<unknown>;
}

export function LotDialog({
  accounts,
  instruments,
  lot,
  onClose,
  onCreate,
  onUpdate,
}: LotDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedInstrumentFallback: InvestmentInstrumentOption | null = lot
    ? {
        id: lot.instrumentId,
        name: lot.instrumentName,
        symbol: lot.symbol,
        isActive: false,
      }
    : null;
  const selectedAccountFallback: InvestmentAccountOption | null =
    lot?.accountId
      ? { id: lot.accountId, name: lot.accountName ?? "Arşivlenmiş hesap", isArchived: true }
      : null;
  const selectableInstruments = uniqueById([
    ...instruments.filter((item) => item.isActive || item.id === lot?.instrumentId),
    ...(selectedInstrumentFallback ? [selectedInstrumentFallback] : []),
  ]);
  const selectableAccounts = uniqueById([
    ...accounts.filter((item) => !item.isArchived || item.id === lot?.accountId),
    ...(selectedAccountFallback ? [selectedAccountFallback] : []),
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const quantity = positiveDecimalString(formString(values, "quantity"));
    const unitPrice = positiveDecimalString(formString(values, "unitPrice"));
    const instrumentId = formString(values, "instrumentId");
    const purchasedAt = formString(values, "purchasedAt");
    if (!instrumentId) {
      setError("Bir yatırım aracı seçin.");
      return;
    }
    if (!quantity || !unitPrice) {
      setError("Adet ve alış fiyatı sıfırdan büyük olmalı.");
      return;
    }
    if (!purchasedAt) {
      setError("Alış tarihini seçin.");
      return;
    }

    const accountId = formString(values, "accountId");
    const notes = formString(values, "notes").trim();
    const common: InvestmentLotValues = {
      instrumentId,
      accountId: accountId || null,
      quantity,
      unitPrice,
      purchasedAt: isoAtLocalNoon(purchasedAt),
      notes: notes || null,
    };
    setError(null);
    setBusy(true);
    void Promise.resolve()
      .then(() =>
        lot
          ? onUpdate(lot.id, { ...common, version: lot.version })
          : onCreate(common),
      )
      .then(onClose)
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="lot-dialog"
      className="compact-dialog"
      open
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form id="lot-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input type="hidden" name="lotId" value={lot?.id ?? ""} />
        <input type="hidden" name="version" value={lot?.version ?? ""} />
        <DialogHeader
          eyebrow="Portföy"
          title={lot ? "Alımı düzenle" : "Birikim alımı"}
          closeLabel="Alım penceresini kapat"
        />
        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Yatırım aracı</span>
            <select
              name="instrumentId"
              defaultValue={lot?.instrumentId ?? ""}
              disabled={busy}
              required
            >
              <option value="">Yatırım aracı seçin</option>
              {selectableInstruments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.symbol ? ` (${item.symbol})` : ""}
                  {!item.isActive ? " · Pasif" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Adet</span>
            <input
              name="quantity"
              inputMode="decimal"
              defaultValue={lot?.quantity ?? ""}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>Alış fiyatı</span>
            <input
              name="unitPrice"
              inputMode="decimal"
              defaultValue={lot?.unitPrice ?? ""}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>Alış tarihi</span>
            <input
              name="purchasedAt"
              type="date"
              defaultValue={lot ? isoDay(lot.purchasedAt) : today()}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>İlişkili hesap (isteğe bağlı)</span>
            <select
              name="accountId"
              defaultValue={lot?.accountId ?? ""}
              disabled={busy}
            >
              <option value="">Hesap ilişkilendirme</option>
              {selectableAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.isArchived ? " · Arşivli" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="full-field">
            <span>Not</span>
            <input
              name="notes"
              maxLength={1000}
              defaultValue={lot?.notes ?? ""}
              disabled={busy}
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

interface PortfolioInstrumentOption extends InvestmentInstrumentOption {
  readonly quantity?: string;
}

export interface SaleDialogProps extends InvestmentDialogBaseProps {
  portfolio: readonly InvestmentPortfolioViewModel[];
  sale: InvestmentSaleViewModel | null;
  onCreate: (values: InvestmentSaleValues) => Promise<unknown>;
  onUpdate: (id: string, values: UpdateInvestmentSaleValues) => Promise<unknown>;
}

export function SaleDialog({
  accounts,
  instruments,
  onClose,
  onCreate,
  onUpdate,
  portfolio,
  sale,
}: SaleDialogProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const portfolioInstruments: readonly PortfolioInstrumentOption[] = portfolio
    .filter((item) => positiveDecimalString(item.quantity) !== null)
    .map((item) => ({
      id: item.instrumentId,
      name: item.name,
      symbol: item.symbol,
      isActive:
        instruments.find((instrument) => instrument.id === item.instrumentId)?.isActive ?? true,
      quantity: item.quantity,
    }));
  const selectedInstrumentFallback: PortfolioInstrumentOption | null = sale
    ? {
        id: sale.instrumentId,
        name: sale.instrumentName,
        symbol: sale.symbol,
        isActive: false,
      }
    : null;
  const selectableInstruments = uniqueById<PortfolioInstrumentOption>(
    sale
      ? [
          ...instruments.filter((item) => item.isActive || item.id === sale.instrumentId),
          ...(selectedInstrumentFallback ? [selectedInstrumentFallback] : []),
        ]
      : portfolioInstruments,
  );
  const selectedAccountFallback: InvestmentAccountOption | null = sale
    ? {
        id: sale.destinationAccountId,
        name: sale.destinationAccountName,
        isArchived: true,
      }
    : null;
  const selectableAccounts = uniqueById([
    ...accounts.filter(
      (item) => !item.isArchived || item.id === sale?.destinationAccountId,
    ),
    ...(selectedAccountFallback ? [selectedAccountFallback] : []),
  ]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const quantity = positiveDecimalString(formString(values, "quantity"));
    const unitPrice = positiveDecimalString(formString(values, "unitPrice"));
    const instrumentId = formString(values, "instrumentId");
    const destinationAccountId = formString(values, "destinationAccountId");
    const soldAt = formString(values, "soldAt");
    if (!instrumentId) {
      setError("Satılacak yatırım aracını seçin.");
      return;
    }
    if (!destinationAccountId) {
      setError("Satış bedelinin geçtiği hesabı seçin.");
      return;
    }
    if (!quantity || !unitPrice) {
      setError("Satış adedi ve fiyatı sıfırdan büyük olmalı.");
      return;
    }
    if (!soldAt) {
      setError("Satış tarihini seçin.");
      return;
    }

    const notes = formString(values, "notes").trim();
    const common: InvestmentSaleValues = {
      instrumentId,
      destinationAccountId,
      quantity,
      unitPrice,
      soldAt: isoAtLocalNoon(soldAt),
      notes: notes || null,
    };
    setError(null);
    setBusy(true);
    void Promise.resolve()
      .then(() =>
        sale
          ? onUpdate(sale.id, { ...common, version: sale.version })
          : onCreate(common),
      )
      .then(onClose)
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="sale-dialog"
      className="compact-dialog"
      open
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form id="sale-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <input name="saleId" type="hidden" value={sale?.id ?? ""} />
        <input name="version" type="hidden" value={sale?.version ?? ""} />
        <DialogHeader
          eyebrow="Portföy"
          title={sale ? "Satışı düzenle" : "Birikim satışı"}
          closeLabel="Satış penceresini kapat"
        />
        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Satılacak yatırım aracı</span>
            <select
              name="instrumentId"
              defaultValue={sale?.instrumentId ?? ""}
              disabled={busy}
              required
            >
              <option value="">Yatırım aracı seçin</option>
              {selectableInstruments.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                  {item.symbol ? ` (${item.symbol})` : ""}
                  {item.quantity ? ` · ${item.quantity} adet` : ""}
                  {!item.isActive ? " · Pasif" : ""}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Satılacak adet</span>
            <input
              name="quantity"
              inputMode="decimal"
              defaultValue={sale?.quantity ?? ""}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>Birim satış fiyatı</span>
            <input
              name="unitPrice"
              inputMode="decimal"
              defaultValue={sale?.unitPrice ?? ""}
              disabled={busy}
              required
            />
          </label>
          <label>
            <span>Satış tarihi</span>
            <input
              name="soldAt"
              type="date"
              defaultValue={sale ? isoDay(sale.soldAt) : today()}
              disabled={busy}
              required
            />
          </label>
          <label className="full-field">
            <span>Para hangi hesaba geçti?</span>
            <select
              name="destinationAccountId"
              defaultValue={sale?.destinationAccountId ?? ""}
              disabled={busy}
              required
            >
              <option value="">Paranın geçtiği hesabı seçin</option>
              {selectableAccounts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.isArchived ? " · Arşivli" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="full-field">
            <span>Not</span>
            <input
              name="notes"
              maxLength={1000}
              defaultValue={sale?.notes ?? ""}
              disabled={busy}
            />
          </label>
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            {sale ? "Değişiklikleri kaydet" : "Satışı kaydet"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
