import { useMemo, useState, type FormEvent } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogFeedback,
  DialogHeader,
} from "../../components/ui";
import { isoAtLocalNoon, today } from "../../lib/date";
import { errorMessage } from "../../lib/error-message";
import { moneyInCurrency, toNumber } from "../../lib/format";
import { positiveDecimalString } from "../investments/decimal";
import type { FxAccountOption, FxConversionValues } from "./fx-types";

export interface FxConversionDialogProps {
  accounts: readonly FxAccountOption[];
  initialMode?: "buy" | "sell";
  onClose: () => void;
  onSubmit: (values: FxConversionValues) => Promise<unknown>;
}

export function FxConversionDialog({
  accounts,
  initialMode = "buy",
  onClose,
  onSubmit,
}: FxConversionDialogProps) {
  const [mode, setMode] = useState<"buy" | "sell">(initialMode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [foreignAccountId, setForeignAccountId] = useState("");
  const [tryAccountId, setTryAccountId] = useState("");
  const [tryAmount, setTryAmount] = useState("");
  const [foreignAmount, setForeignAmount] = useState("");

  const tryAccounts = useMemo(
    () => accounts.filter((account) => account.currencyCode === "TRY" && !account.isArchived),
    [accounts],
  );
  const foreignAccounts = useMemo(
    () => accounts.filter((account) => account.currencyCode !== "TRY" && !account.isArchived),
    [accounts],
  );
  const foreignCurrency =
    foreignAccounts.find((account) => account.id === foreignAccountId)?.currencyCode ?? "";

  const effectiveRate =
    toNumber(foreignAmount) > 0 ? toNumber(tryAmount) / toNumber(foreignAmount) : null;

  const buying = mode === "buy";

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedTry = positiveDecimalString(tryAmount);
    const parsedForeign = positiveDecimalString(foreignAmount);
    if (!foreignAccountId) {
      setError("Döviz hesabını seçin.");
      return;
    }
    if (!tryAccountId) {
      setError("TL hesabını seçin.");
      return;
    }
    if (!parsedTry || !parsedForeign) {
      setError("Her iki tutar da sıfırdan büyük olmalı.");
      return;
    }
    const values: FxConversionValues = buying
      ? {
          fromAccountId: tryAccountId,
          toAccountId: foreignAccountId,
          fromAmount: parsedTry,
          toAmount: parsedForeign,
          transactionDate: isoAtLocalNoon(today()),
          notes: null,
        }
      : {
          fromAccountId: foreignAccountId,
          toAccountId: tryAccountId,
          fromAmount: parsedForeign,
          toAmount: parsedTry,
          transactionDate: isoAtLocalNoon(today()),
          notes: null,
        };
    setError(null);
    setBusy(true);
    void Promise.resolve()
      .then(() => onSubmit(values))
      .then(onClose)
      .catch((reason: unknown) => setError(errorMessage(reason)))
      .finally(() => setBusy(false));
  };

  return (
    <Dialog
      id="fx-conversion-dialog"
      className="compact-dialog"
      open
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <form id="fx-conversion-form" onSubmit={handleSubmit} aria-busy={busy || undefined}>
        <DialogHeader
          eyebrow="Döviz"
          title={buying ? "Döviz al" : "Döviz sat"}
          closeLabel="Pencereyi kapat"
        />
        <div className="form-grid dialog-form-grid">
          <div className="full-field range-switch" role="group" aria-label="Yön">
            <button
              type="button"
              className={buying ? "active" : ""}
              aria-pressed={buying}
              disabled={busy}
              onClick={() => setMode("buy")}
            >
              Döviz al (TL → döviz)
            </button>
            <button
              type="button"
              className={!buying ? "active" : ""}
              aria-pressed={!buying}
              disabled={busy}
              onClick={() => setMode("sell")}
            >
              Döviz sat (döviz → TL)
            </button>
          </div>

          {foreignAccounts.length === 0 ? (
            <p className="full-field">
              Önce yabancı para biriminde bir hesap açın (Hesaplar sayfası). Döviz burada o
              hesaba girer/çıkar.
            </p>
          ) : null}

          <label>
            <span>TL hesabı</span>
            <select
              value={tryAccountId}
              disabled={busy}
              onChange={(event) => setTryAccountId(event.target.value)}
              required
            >
              <option value="">TL hesabı seçin</option>
              {tryAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Döviz hesabı</span>
            <select
              value={foreignAccountId}
              disabled={busy}
              onChange={(event) => setForeignAccountId(event.target.value)}
              required
            >
              <option value="">Döviz hesabı seçin</option>
              {foreignAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} · {account.currencyCode}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>{buying ? "Ödenen tutar (TL)" : "Alınan tutar (TL)"}</span>
            <input
              inputMode="decimal"
              value={tryAmount}
              disabled={busy}
              onChange={(event) => setTryAmount(event.target.value)}
              required
            />
          </label>
          <label>
            <span>{buying ? "Alınan tutar" : "Satılan tutar"}{foreignCurrency ? ` (${foreignCurrency})` : ""}</span>
            <input
              inputMode="decimal"
              value={foreignAmount}
              disabled={busy}
              onChange={(event) => setForeignAmount(event.target.value)}
              required
            />
          </label>
          <p className="full-field" data-testid="fx-effective-rate">
            {effectiveRate !== null
              ? `Efektif kur: ${effectiveRate.toLocaleString("tr-TR", { minimumFractionDigits: 4, maximumFractionDigits: 6 })}${
                  foreignCurrency ? ` (1 ${foreignCurrency})` : ""
                }`
              : "Efektif kur, iki tutarı girince hesaplanır."}
          </p>
          {effectiveRate !== null && foreignCurrency ? (
            <p className="full-field">
              <small>
                {buying ? "Çıkan" : "Giren"} TL {moneyInCurrency(tryAmount, "TRY")} ·{" "}
                {buying ? "Giren" : "Çıkan"} {moneyInCurrency(foreignAmount, foreignCurrency)}
              </small>
            </p>
          ) : null}
        </div>
        <DialogFeedback message={error} />
        <DialogActions>
          <DialogCancelButton disabled={busy}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={busy}>
            {buying ? "Dövizi al" : "Dövizi sat"}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
