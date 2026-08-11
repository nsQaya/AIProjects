import { useState, type FormEvent } from "react";
import type { AccountType, MoneyString } from "@defterx/contracts";

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

const ACCOUNT_TYPE_OPTIONS = [
  { value: "BANK", label: "Vadesiz / banka" },
  { value: "CASH", label: "Nakit" },
  { value: "CREDIT_CARD", label: "Kredi kartı" },
  { value: "OTHER", label: "Diğer" },
] as const satisfies ReadonlyArray<{ value: AccountType; label: string }>;

interface AccountDialogProps {
  account: AccountViewModel | null;
  onClose: () => void;
  onCreate: (values: CreateAccountValues) => AccountMutation;
  onUpdate: (id: string, values: UpdateAccountValues) => AccountMutation;
}

function amountInputValue(value: MoneyString | null): string {
  if (value === null || value === "") return "";
  return value.replace(".", ",");
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
  onClose,
  onCreate,
  onUpdate,
}: AccountDialogProps) {
  const editing = account !== null;
  const [accountType, setAccountType] = useState<AccountType>(account?.accountType ?? "BANK");
  const [openingBalance, setOpeningBalance] = useState("0");
  const [allowNegativeBalance, setAllowNegativeBalance] = useState(
    account?.allowNegativeBalance ?? false,
  );
  const [creditLimit, setCreditLimit] = useState(amountInputValue(account?.creditLimit ?? null));
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleAccountTypeChange = (value: AccountType) => {
    const allowsNegative = value === "CREDIT_CARD";
    setAccountType(value);
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
      const submittedAccountType = read("accountType") as AccountType;
      const submittedAllowNegative = form.has("allowNegativeBalance");
      const submittedCreditLimit = read("creditLimit");
      const trimmedName = read("name").trim();
      if (!trimmedName) throw new Error("Hesap adı zorunludur.");

      const normalizedLimit = submittedAllowNegative && submittedCreditLimit.trim()
        ? nonNegativeMoney(submittedCreditLimit, "Eksi bakiye / kredi limiti")
        : null;
      const values = {
        name: trimmedName,
        accountType: submittedAccountType,
        allowNegativeBalance: submittedAllowNegative,
        creditLimit: normalizedLimit,
      } satisfies AccountFormValues;

      setSubmitting(true);
      const result = editing
        ? await onUpdate(account.id, { ...values, version: account.version })
        : await onCreate({
            ...values,
            openingBalance: nonNegativeMoney(read("openingBalance"), "Açılış bakiyesi"),
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
              name="accountType"
              required
              value={accountType}
              onChange={(event) => handleAccountTypeChange(event.currentTarget.value as AccountType)}
            >
              {!ACCOUNT_TYPE_OPTIONS.some((option) => option.value === accountType) ? (
                <option value={accountType}>{accountType}</option>
              ) : null}
              {ACCOUNT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {!editing ? (
            <label className="opening-field">
              <span>Açılış bakiyesi</span>
              <input
                inputMode="decimal"
                name="openingBalance"
                required
                value={openingBalance}
                onChange={(event) => setOpeningBalance(event.currentTarget.value)}
              />
            </label>
          ) : null}

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
