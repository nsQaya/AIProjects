const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
});

const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const editableAmountPattern = /^\d{0,14}(?:,\d{0,6})?$/;

export function toNumber(value: number | string | null | undefined): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function money(value: number | string | null | undefined): string {
  return currencyFormatter.format(toNumber(value));
}

export function moneyInCurrency(
  value: number | string | null | undefined,
  currency: string,
): string {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 6,
    }).format(toNumber(value));
  } catch {
    return `${toNumber(value).toLocaleString("tr-TR")} ${currency}`;
  }
}

export function signedMoney(value: number | string, kind: string): string {
  const amount = Math.abs(toNumber(value));
  if (["transfer", "opening_balance", "adjustment"].includes(kind)) {
    return money(amount);
  }
  return money(kind === "income" ? amount : -amount);
}

export function shortMoney(value: number | string): string {
  const amount = toNumber(value);
  if (Math.abs(amount) >= 1_000) {
    const compact = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 });
    return `${compact.format(amount / 1_000)} B`;
  }
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(amount);
}

export function dateText(value: string): string {
  const normalized = value.includes("T") ? value : `${value}T12:00:00`;
  return dateFormatter.format(new Date(normalized));
}

/** Converts API decimals and typed dots to the Turkish decimal separator. */
export function editableAmount(value: string): string | null {
  const localized = value.replace(/\./g, ",");
  return editableAmountPattern.test(localized) ? localized : null;
}

export function parseAmount(value: string): number {
  const normalized = value.trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export function decimalString(value: string): string | null {
  const amount = parseAmount(value);
  return amount > 0 ? String(amount) : null;
}
