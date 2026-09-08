import { useMemo, useState, type FormEvent } from "react";

import {
  Button,
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogFeedback,
  DialogHeader,
  SearchableSelect,
} from "../../components/ui";
import { isoAtLocalNoon, today } from "../../lib/date";
import { errorMessage } from "../../lib/error-message";
import { decimalString, editableAmount } from "../../lib/format";
import type { TransactionDialogProps, TransactionFormKind } from "./transaction-types";

function formString(values: FormData, key: string): string {
  const value = values.get(key);
  return typeof value === "string" ? value : "";
}

export function TransactionDialog({
  accounts,
  categories,
  costCenters,
  onClose,
  onSave,
  open,
  transaction,
  prefill,
  title,
}: TransactionDialogProps) {
  const seed = transaction ?? prefill;
  const [kind, setKind] = useState<TransactionFormKind>(
    () => ((transaction?.type ?? prefill?.type)?.toLowerCase() ?? "expense") as TransactionFormKind,
  );
  const [amount, setAmount] = useState(
    () => editableAmount(seed?.amount ?? "") ?? "",
  );
  const [description, setDescription] = useState(
    () => seed?.title ?? "",
  );
  const [date, setDate] = useState(
    () => (transaction?.transactionDate ?? prefill?.transactionDate)?.slice(0, 10) ?? today(),
  );
  const [accountId, setAccountId] = useState(
    () => seed?.accountId ?? accounts.find((account) => !account.isArchived)?.id ?? "",
  );
  const [targetAccountId, setTargetAccountId] = useState(() => seed?.targetAccountId ?? "");
  const [categoryId, setCategoryId] = useState(() => seed?.categoryId ?? "");
  const [costCenterId, setCostCenterId] = useState(() => seed?.costCenterId ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const availableAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived || account.id === seed?.accountId || account.id === seed?.targetAccountId),
    [accounts, seed],
  );

  const availableCategories = useMemo(
    () => categories.filter((category) => category.isActive || category.id === seed?.categoryId),
    [categories, seed],
  );
  const availableCostCenters = useMemo(
    () => costCenters.filter((item) => item.isActive || item.id === seed?.costCenterId),
    [costCenters, seed],
  );

  const close = () => {
    if (!submitting) onClose();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const submittedKind = formString(values, "kind") as TransactionFormKind;
    const submittedAccountId = formString(values, "accountId");
    const submittedTargetAccountId = formString(values, "targetAccountId");
    const submittedCategoryId = formString(values, "categoryId");
    const submittedCostCenterId = formString(values, "costCenterId");
    const submittedDate = formString(values, "date");
    const normalizedAmount = decimalString(formString(values, "amount"));
    const title = formString(values, "description").trim();

    if (!normalizedAmount) {
      setFeedback("Sıfırdan büyük bir tutar girin.");
      return;
    }
    if (!title) {
      setFeedback("Açıklama alanını doldurun.");
      return;
    }
    if (!submittedAccountId) {
      setFeedback("Kaynak hesabı seçin.");
      return;
    }
    if (submittedKind === "transfer" && !submittedTargetAccountId) {
      setFeedback("Hedef hesabı seçin.");
      return;
    }
    if (submittedKind === "transfer" && submittedAccountId === submittedTargetAccountId) {
      setFeedback("Kaynak ve hedef hesap farklı olmalı.");
      return;
    }
    if (submittedKind !== "transfer" && !submittedCategoryId) {
      setFeedback("Kategori seçin.");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      await onSave(
        {
          type: submittedKind.toUpperCase() as "INCOME" | "EXPENSE" | "TRANSFER",
          title,
          amount: normalizedAmount,
          accountId: submittedAccountId,
          transactionDate: isoAtLocalNoon(submittedDate),
          ...(submittedKind === "transfer"
            ? { targetAccountId: submittedTargetAccountId }
            : submittedCategoryId
              ? { categoryId: submittedCategoryId }
              : {}),
          ...(submittedKind === "expense" && submittedCostCenterId
            ? { costCenterId: submittedCostCenterId }
            : {}),
        },
        transaction,
      );
      onClose();
    } catch (caught) {
      setFeedback(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog id="transaction-dialog" open={open} onClose={close}>
      <form id="transaction-form" onSubmit={(event) => void submit(event)}>
        <input type="hidden" name="transactionId" value={transaction?.id ?? ""} readOnly />
        <DialogHeader
          eyebrow="Canlı kayıt"
          title={title ?? (transaction ? "İşlemi düzelt" : "Yeni işlem")}
        />

        <div className="type-tabs">
          {(["expense", "income", "transfer"] as const).map((value) => (
            <label key={value}>
              <input
                type="radio"
                name="kind"
                value={value}
                checked={kind === value}
                onChange={() => {
                  setKind(value);
                  setFeedback("");
                }}
              />
              <span>{value === "expense" ? "Gider" : value === "income" ? "Gelir" : "Transfer"}</span>
            </label>
          ))}
        </div>

        <label className="amount-field" htmlFor="transaction-amount">
          <span>Tutar</span>
          <div>
            <input
              id="transaction-amount"
              name="amount"
              inputMode="decimal"
              value={amount}
              onChange={(event) => {
                const nextAmount = editableAmount(event.target.value);
                if (nextAmount !== null) setAmount(nextAmount);
              }}
              required
            />
            <b>₺</b>
          </div>
        </label>

        <div className="form-grid">
          <label>
            <span>Açıklama</span>
            <input name="description" maxLength={200} value={description} onChange={(event) => setDescription(event.target.value)} required />
          </label>
          <label>
            <span>Tarih</span>
            <input name="date" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
          </label>
          <label>
            <span id="transaction-account-caption">{kind === "transfer" ? "Kaynak hesap" : "Hesap"}</span>
            <SearchableSelect
              name="accountId"
              value={accountId}
              onChange={setAccountId}
              required
              placeholder="Hesap seçin"
              options={availableAccounts.map((account) => ({
                value: account.id,
                label: account.name,
                hint: account.isArchived ? "· Arşivli" : undefined,
              }))}
            />
          </label>

          <label id="target-account-field" hidden={kind !== "transfer"}>
            <span>Hedef hesap</span>
            <SearchableSelect
              name="targetAccountId"
              value={targetAccountId}
              onChange={setTargetAccountId}
              required={kind === "transfer"}
              disabled={kind !== "transfer"}
              placeholder="Hedef hesap seçin"
              options={availableAccounts.map((account) => ({
                value: account.id,
                label: account.name,
                hint: account.isArchived ? "· Arşivli" : undefined,
              }))}
            />
          </label>
          <label id="category-field" hidden={kind === "transfer"}>
            <span>Kategori</span>
            <SearchableSelect
              name="categoryId"
              value={categoryId}
              onChange={setCategoryId}
              disabled={kind === "transfer"}
              required={kind !== "transfer"}
              placeholder="Kategori seçin"
              options={availableCategories
                .filter((category) => category.categoryType === kind.toUpperCase())
                .map((category) => ({
                  value: category.id,
                  label: category.name,
                  hint: category.isActive ? undefined : "· Pasif",
                }))}
            />
          </label>
          <label id="cost-center-field" hidden={kind !== "expense"}>
            <span>Masraf merkezi</span>
            <SearchableSelect
              name="costCenterId"
              value={costCenterId}
              onChange={setCostCenterId}
              disabled={kind !== "expense"}
              placeholder="Masraf merkezi seçin (isteğe bağlı)"
              options={[
                { value: "", label: "Masraf merkezi seçin (isteğe bağlı)" },
                ...availableCostCenters.map((item) => ({
                  value: item.id,
                  label: item.name,
                  hint: item.isActive ? undefined : "· Pasif",
                })),
              ]}
            />
          </label>
        </div>

        <DialogFeedback message={feedback} />
        <DialogActions>
          <DialogCancelButton disabled={submitting}>Vazgeç</DialogCancelButton>
          <Button variant="primary" type="submit" loading={submitting}>Kaydet</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
