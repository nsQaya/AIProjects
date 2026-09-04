import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { AccountPostingContextDTO } from "@defterx/contracts";

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
import { decimalString, editableAmount } from "../../lib/format";
import type { SharedAccountView } from "../../finance/finance-views";
import type { AccountSharingApi, SharedAccountTransactionDraft } from "./account-types";

type Kind = "expense" | "income";

interface SharedAccountTransactionDialogProps {
  account: SharedAccountView;
  sharing: Pick<AccountSharingApi, "loadPostingContext" | "createSharedTransaction">;
  onClose: () => void;
}

export function SharedAccountTransactionDialog({
  account,
  sharing,
  onClose,
}: SharedAccountTransactionDialogProps) {
  const [context, setContext] = useState<AccountPostingContextDTO | null>(null);
  const [kind, setKind] = useState<Kind>("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(today());
  const [categoryId, setCategoryId] = useState("");
  const [costCenterId, setCostCenterId] = useState("");
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    sharing
      .loadPostingContext(account.id)
      .then((value) => {
        if (active) setContext(value);
      })
      .catch((error: unknown) => {
        if (active) setFeedback(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [account.id, sharing]);

  const categories = useMemo(
    () =>
      (context?.categories ?? []).filter(
        (category) => category.isActive && category.categoryType === kind.toUpperCase(),
      ),
    [context, kind],
  );
  const costCenters = useMemo(
    () => (context?.costCenters ?? []).filter((item) => item.isActive),
    [context],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedAmount = decimalString(amount);
    const title = description.trim();
    if (!normalizedAmount) {
      setFeedback("Sıfırdan büyük bir tutar girin.");
      return;
    }
    if (!title) {
      setFeedback("Açıklama alanını doldurun.");
      return;
    }
    if (!categoryId) {
      setFeedback("Kategori seçin.");
      return;
    }

    const draft: SharedAccountTransactionDraft = {
      type: kind.toUpperCase() as "INCOME" | "EXPENSE",
      title,
      amount: normalizedAmount,
      categoryId,
      transactionDate: isoAtLocalNoon(date),
      ...(kind === "expense" && costCenterId ? { costCenterId } : {}),
    };

    setSubmitting(true);
    setFeedback("");
    try {
      await sharing.createSharedTransaction(
        account.ownerBookId,
        account.id,
        account.currencyCode,
        draft,
      );
      onClose();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      id="shared-account-transaction-dialog"
      open
      onClose={() => {
        if (!submitting) onClose();
      }}
    >
      <form onSubmit={(event) => void submit(event)}>
        <DialogHeader
          eyebrow={`${account.ownerName} · ${account.name}`}
          title="Paylaşılan hesaba işlem ekle"
        />

        <div className="type-tabs">
          {(["expense", "income"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setCategoryId("");
                  setFeedback("");
                }}
              />
              <span>{value === "expense" ? "Gider" : "Gelir"}</span>
            </label>
          ))}
        </div>

        <label className="amount-field" htmlFor="shared-transaction-amount">
          <span>Tutar ({account.currencyCode})</span>
          <div>
            <input
              id="shared-transaction-amount"
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const next = editableAmount(event.target.value);
                if (next !== null) setAmount(next);
              }}
              required
            />
          </div>
        </label>

        <div className="form-grid">
          <label>
            <span>Açıklama</span>
            <input
              name="description"
              maxLength={200}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Tarih</span>
            <input
              name="date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </label>
          <label>
            <span>Kategori</span>
            <select
              name="categoryId"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              required
              disabled={context === null}
            >
              <option value="">Kategori seçin</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label hidden={kind !== "expense"}>
            <span>Masraf merkezi</span>
            <select
              name="costCenterId"
              value={costCenterId}
              onChange={(event) => setCostCenterId(event.target.value)}
              disabled={kind !== "expense" || context === null}
            >
              <option value="">Masraf merkezi seçin (isteğe bağlı)</option>
              {costCenters.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="muted">
          Bu işlem {account.ownerName} kişisinin defterine kaydedilir.
        </p>
        <DialogFeedback message={feedback} />
        <DialogActions>
          <DialogCancelButton disabled={submitting}>Vazgeç</DialogCancelButton>
          <Button type="submit" variant="primary" loading={submitting} disabled={context === null}>
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
