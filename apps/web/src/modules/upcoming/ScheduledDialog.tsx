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
import { decimalString, editableAmount } from "../../lib/format";
import type { ScheduledDialogProps, ScheduledFormKind, ScheduledRepeat } from "./scheduled-types";

function formString(values: FormData, key: string): string {
  const value = values.get(key);
  return typeof value === "string" ? value : "";
}

export function ScheduledDialog({ accounts, categories, costCenters, item, onClose, onSave, open }: ScheduledDialogProps) {
  const initialDate = item?.scheduledAt.slice(0, 10) ?? today();
  const [kind, setKind] = useState<ScheduledFormKind>(
    () => (item?.transactionType.toLowerCase() ?? "expense") as ScheduledFormKind,
  );
  const [date, setDate] = useState(initialDate);
  const [title, setTitle] = useState(() => item?.title ?? "");
  const [amount, setAmount] = useState(() => editableAmount(item?.amount ?? "") ?? "");
  const [accountId, setAccountId] = useState(
    () => item?.accountId ?? accounts.find((account) => !account.isArchived)?.id ?? "",
  );
  const [targetAccountId, setTargetAccountId] = useState(() => item?.targetAccountId ?? "");
  const [categoryId, setCategoryId] = useState(() => item?.categoryId ?? "");
  const [costCenterId, setCostCenterId] = useState(() => item?.costCenterId ?? "");
  const [repeat, setRepeat] = useState<ScheduledRepeat>("NONE");
  const [repeatUntil, setRepeatUntil] = useState(initialDate);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  const availableAccounts = useMemo(
    () => accounts.filter((account) => !account.isArchived || account.id === item?.accountId || account.id === item?.targetAccountId),
    [accounts, item],
  );
  const availableCategories = useMemo(
    () => categories.filter((category) => category.isActive || category.id === item?.categoryId),
    [categories, item],
  );
  const availableCostCenters = useMemo(
    () => costCenters.filter((costCenter) => costCenter.isActive || costCenter.id === item?.costCenterId),
    [costCenters, item],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const submittedKind = formString(values, "kind") as ScheduledFormKind;
    const submittedDate = formString(values, "date");
    const submittedTitle = formString(values, "title").trim();
    const submittedAccountId = formString(values, "accountId");
    const submittedTargetAccountId = formString(values, "targetAccountId");
    const submittedCategoryId = formString(values, "categoryId");
    const submittedCostCenterId = formString(values, "costCenterId");
    const submittedRepeat = (formString(values, "repeat") || "NONE") as ScheduledRepeat;
    const submittedRepeatUntil = formString(values, "repeatUntil");
    const normalizedAmount = decimalString(formString(values, "amount"));
    if (!normalizedAmount) {
      setFeedback("Sıfırdan büyük bir tutar girin.");
      return;
    }
    if (!submittedTitle) {
      setFeedback("Başlık alanını doldurun.");
      return;
    }
    if (!submittedAccountId) {
      setFeedback("Hesap seçin.");
      return;
    }
    if (submittedKind === "transfer" && !submittedTargetAccountId) {
      setFeedback("Hedef hesap seçin.");
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
    if (!item && submittedRepeat !== "NONE" && (!submittedRepeatUntil || submittedRepeatUntil < submittedDate)) {
      setFeedback("Tekrar bitiş tarihi ilk işlem tarihinden önce olamaz.");
      return;
    }

    setSubmitting(true);
    setFeedback("");
    try {
      await onSave(
        {
          transactionType: submittedKind.toUpperCase() as "INCOME" | "EXPENSE" | "TRANSFER",
          title: submittedTitle,
          amount: normalizedAmount,
          accountId: submittedAccountId,
          scheduledAt: isoAtLocalNoon(submittedDate),
          targetAccountId: submittedKind === "transfer" ? submittedTargetAccountId : null,
          categoryId: submittedKind === "transfer" ? null : submittedCategoryId,
          costCenterId: submittedKind === "expense" && submittedCostCenterId
            ? submittedCostCenterId
            : null,
          ...(!item && submittedRepeat !== "NONE"
            ? {
                recurrence: {
                  frequency: submittedRepeat,
                  interval: 1,
                  until: isoAtLocalNoon(submittedRepeatUntil),
                },
              }
            : {}),
        },
        item,
      );
      onClose();
    } catch (caught) {
      setFeedback(errorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog id="scheduled-dialog" className="compact-dialog" open={open} onClose={() => { if (!submitting) onClose(); }}>
      <form id="scheduled-form" onSubmit={(event) => void submit(event)}>
        <input type="hidden" name="scheduledId" value={item?.id ?? ""} readOnly />
        <input type="hidden" name="version" value={item?.version ?? ""} readOnly />
        <DialogHeader eyebrow="Gelecek hareket" title={item ? "Planı düzenle" : "Planlı işlem"} />
        <div className="form-grid dialog-form-grid">
          <label>
            <span>Tür</span>
            <select name="kind" value={kind} onChange={(event) => { setKind(event.target.value as ScheduledFormKind); setFeedback(""); }}>
              <option value="expense">Ödeme / gider</option>
              <option value="income">Tahsilat / gelir</option>
              <option value="transfer">Hesaplar arası transfer</option>
            </select>
          </label>
          <label><span>İlk işlem tarihi</span><input name="date" type="date" value={date} onChange={(event) => { setDate(event.target.value); if (repeatUntil < event.target.value) setRepeatUntil(event.target.value); }} required /></label>
          <label className="full-field"><span>Başlık</span><input name="title" maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
          <label><span>Tutar</span><input name="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} required /></label>
          <label>
            <span id="scheduled-account-caption">{kind === "transfer" ? "Kaynak hesap" : "Hesap"}</span>
            <select name="accountId" value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
              <option value="">Hesap seçin</option>
              {availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}{account.isArchived ? " · Arşivli" : ""}</option>)}
            </select>
          </label>
          <label className="scheduled-target" hidden={kind !== "transfer"}><span>Hedef hesap</span><select name="targetAccountId" value={targetAccountId} onChange={(event) => setTargetAccountId(event.target.value)} required={kind === "transfer"} disabled={kind !== "transfer"}><option value="">Hedef seçin</option>{availableAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label className="scheduled-category" hidden={kind === "transfer"}><span>Kategori</span><select name="categoryId" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required={kind !== "transfer"} disabled={kind === "transfer"}><option value="">Kategori seçin</option>{availableCategories.filter((category) => category.categoryType === kind.toUpperCase()).map((category) => <option key={category.id} value={category.id}>{category.name}{category.isActive ? "" : " · Pasif"}</option>)}</select></label>
          <label className="scheduled-cost-center" hidden={kind !== "expense"}>
            <span>Masraf merkezi</span>
            <select
              name="costCenterId"
              value={costCenterId}
              onChange={(event) => setCostCenterId(event.target.value)}
              disabled={kind !== "expense"}
            >
              <option value="">Masraf merkezi seçin (isteğe bağlı)</option>
              {availableCostCenters.map((costCenter) => (
                <option key={costCenter.id} value={costCenter.id}>
                  {costCenter.name}{costCenter.isActive ? "" : " · Pasif"}
                </option>
              ))}
            </select>
          </label>
          {!item ? (
            <label className="scheduled-repeat"><span>Tekrar</span><select name="repeat" value={repeat} onChange={(event) => setRepeat(event.target.value as ScheduledRepeat)}><option value="NONE">Tek sefer</option><option value="WEEKLY">Her hafta</option><option value="MONTHLY">Her ay aynı gün</option><option value="YEARLY">Her yıl</option></select></label>
          ) : null}
          {!item && repeat !== "NONE" ? (
            <label className="scheduled-repeat-until"><span>Şu tarihe kadar</span><input name="repeatUntil" type="date" min={date} value={repeatUntil} onChange={(event) => setRepeatUntil(event.target.value)} required /></label>
          ) : null}
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
