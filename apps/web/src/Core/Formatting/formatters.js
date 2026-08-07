const currencyFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency", currency: "TRY", minimumFractionDigits: 2
});
const dateFormatter = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric", month: "long", year: "numeric"
});

export function money(value) {
  return currencyFormatter.format(Number(value) || 0);
}
export function signedMoney(value, kind) {
  if (kind === "transfer" || kind === "opening_balance" || kind === "adjustment") return money(Math.abs(value));
  return money(kind === "income" ? Math.abs(value) : -Math.abs(value));
}
export function shortMoney(value) {
  const amount = Number(value) || 0;
  if (Math.abs(amount) >= 1000) return `${new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 1 }).format(amount / 1000)} B`;
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(amount);
}
export function dateText(value) {
  const normalized = String(value).includes("T") ? value : `${value}T12:00:00`;
  return dateFormatter.format(new Date(normalized));
}
export function parseAmount(value) {
  const normalized = String(value).trim().replace(/\./g, "").replace(",", ".");
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}
