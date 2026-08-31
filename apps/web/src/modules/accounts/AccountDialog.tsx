import { useState, type FormEvent } from "react";
import type { AccountTypeDTO, CurrencyDTO, MoneyString } from "@defterx/contracts";

import {
  Button,
  Dialog,
  DialogActions,
  DialogCancelButton,
  DialogFeedback,
  DialogHeader,
} from "../../components/ui";
import { errorMessage } from "../../lib/error-message";
import type {
  AccountFormValues,
  AccountMutation,
  AccountViewModel,
  CreateAccountValues,
  UpdateAccountValues,
} from "./account-types";

interface AccountDialogProps {
  account: AccountViewModel | null;
  accountTypes: readonly AccountTypeDTO[];
  currencies: readonly CurrencyDTO[];
  onClose: () => void;
  onCreate: (values: CreateAccountValues) => AccountMutation;
  onUpdate: (id: string, values: UpdateAccountValues) => AccountMutation;
}

function amountInputValue(value: MoneyString | null): string {
  if (value === null || value === "") return "";
  return value.replace(".", ",");
}

/** "1000.000000" -> "1000", "1250.500000" -> "1250,5" for a friendly default. */
function openingBalanceInputValue(value: MoneyString): string {
  const trimmed = value.includes(".") ? value.replace(/\.?0+$/, "") : value;
  return amountInputValue(trimmed || "0");
}

function nonNegativeMoney(value: string, label: string): MoneyString {
  const trimmed = value.trim();
  const normalized = trimmed.replaceAll(".", "").replace(",", ".");
  if (normalized.startsWith("-")) throw new Error(`${label} negatif olamaz.`);
  if (!/^\+?\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error(`${label} geçerli bir tutar olmalı.`);
  }
  return normalized.startsWith("+") ? normalized.slice(1) : normalized;
}

export function AccountDialog({
  account,
  accountTypes,
  currencies,
  onClose,
  onCreate,
  onUpdate,
}: AccountDialogProps) {
  const editing = account !== null;
  const currencyOptions = currencies.filter((option) => option.isEnabled);
  const [accountTypeId, setAccountTypeId] = useState(
    account?.accountTypeId ?? accountTypes[0]?.id ?? "",
  );
  const [openingBalance, setOpeningBalance] = useState(
    account ? openingBalanceInputValue(account.openingBalance) : "0",
  );
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(
    account?.allowNegativeBalance ?? false,
  );
  const [creditLimit, setCreditLimit] = useState(amountInputValue(account?.creditLimit ?? null));
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAccountTypeChange = (value: string) => {
    const type = accountTypes.find((option) => option.id === value);
    const allowsNegative = type?.defaultAllowNegativeBalance ?? false;
    setAccountTypeId(value);
    setAllowNegativeBalance(allowsNegative);
    if (!allowsNegative) setCreditLimit("");
  };

  const handleNegativeBalanceChange = (allowed: boolean) => {
    setAllowNegativeBalance(allowed);
    if (!allowed) setCreditLimit("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback("");

    try {
      const form = new FormData(event.currentTarget);
      const read = (key: string) => {
        const value = form.get(key);
        return typeof value === "string" ? value : "";
      };
      const submittedAccountTypeId = read("accountTypeId");
      const submittedAllowNegative = form.has("allowNegativeBalance");
      const submittedCreditLimit = read("creditLimit");
      const trimmedName = read("name").trim();
      if (!trimmedName) throw new Error("Hesap adı zorunludur.");
      if (!submittedAccountTypeId) throw new Error("Hesap türü zorunludur.");

      const normalizedLimit = submittedAllowNegative && submittedCreditLimit.trim()
        ? nonNegativeMoney(submittedCreditLimit, "Eksi bakiye / kredi limiti")
        : null;
      const values = {
        name: trimmedName,
        accountTypeId: submittedAccountTypeId,
        allowNegativeBalance: submittedAllowNegative,
        creditLimit: normalizedLimit,
      } satisfies AccountFormValues;

      const submittedOpeningBalance = nonNegativeMoney(read("openingBalance"), "Açılış bakiyesi");

      setSubmitting(true);
      const result = editing
        ? await onUpdate(account.id, {
            ...values,
            openingBalance: submittedOpeningBalance,
            version: account.version,
          })
        : await onCreate({
            ...values,
            openingBalance: submittedOpeningBalance,
            currencyCode: read("currencyCode") || "TRY",
          });

      if (result !== false) onClose();
    } catch (error) {
      setFeedback(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      className="compact-dialog"
      id="account-dialog"
      open
      onClose={() => {
        if (!submitting) onClose();
      }}
    >
      <form id="account-form" onSubmit={(event) => void handleSubmit(event)}>
        <input name="accountId" type="hidden" value={account?.id ?? ""} readOnly />
        <input name="version" type="hidden" value={account?.version ?? ""} readOnly />
        <DialogHeader
          closeLabel="Hesap penceresini kapat"
          eyebrow="Hesap tanımı"
          title={editing ? "Hesabı düzenle" : "Hesap ekle"}
        />

        <div className="form-grid dialog-form-grid">
          <label className="full-field">
            <span>Hesap adı</span>
            <input
              autoFocus
              defaultValue={account?.name ?? ""}
              maxLength={120}
              name="name"
              required
            />
          </label>

          <label>
            <span>Hesap türü</span>
            <select
              name="accountTypeId"
              required
              value={accountTypeId}
              onChange={(event) => handleAccountTypeChange(event.currentTarget.value)}
            >
              {!accountTypes.some((option) => option.id === accountTypeId) && account ? (
                <option value={accountTypeId}>{account.accountTypeName}</option>
              ) : null}
              {accountTypes.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>

          {editing ? (
            <label>
              <span>Para birimi</span>
              <input name="currencyDisplay" value={account.currencyCode} readOnly disabled />
              <small>Para birimi hesap açıldıktan sonra değiştirilemez.</small>
            </label>
          ) : (
            <label>
              <span>Para birimi</span>
              <select name="currencyCode" defaultValue="TRY">
                {currencyOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.code} · {option.nameTr}
                  </option>
                ))}
              </select>
              <small>Döviz için önce Ayarlar’dan o para birimini etkinleştirin.</small>
            </label>
          )}

          <label className="opening-field">
            <span>Açılış bakiyesi{editing ? ` (${account.currencyCode})` : ""}</span>
            <input
              inputMode="decimal"
              name="openingBalance"
              required
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.currentTarget.value)}
            />
            {editing ? (
              <small>
                Değiştirirsen eski açılış kaydı iptal edilip yeni tutarla yeniden
                oluşturulur. Şimdiye kadar harcanandan düşük bir tutar reddedilir.
              </small>
            ) : null}
          </label>

          <label className="checkbox-field full-field">
            <input
              checked={allowNegativeBalance}
              name="allowNegativeBalance"
              type="checkbox"
              onChange={(event) => handleNegativeBalanceChange(event.currentTarget.checked)}
            />
            <span>Eksi bakiyeye izin ver</span>
          </label>

          <label className="full-field" id="credit-limit-field" hidden={!allowNegativeBalance}>
            <span>Eksi bakiye / kredi limiti</span>
            <input
              disabled={!allowNegativeBalance}
              inputMode="decimal"
              name="creditLimit"
              placeholder="Limitsiz bırakılabilir"
              value={creditLimit}
              onChange={(event) => setCreditLimit(event.currentTarget.value)}
            />
          </label>
        </div>

        <DialogFeedback message={feedback} />
        <DialogActions>
          <DialogCancelButton disabled={submitting}>Vazgeç</DialogCancelButton>
          <Button loading={submitting} type="submit" variant="primary">
            Kaydet
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
