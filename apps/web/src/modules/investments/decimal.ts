import type { MoneyString } from "@defterx/contracts";

/**
 * Converts a user-entered positive decimal to an API money string without a
 * floating-point round-trip. Both Turkish (`1.234,56`) and API (`1234.56`)
 * forms are accepted; the caller retains every fractional digit entered.
 */
export function positiveDecimalString(value: string): MoneyString | null {
  let compact = value.trim().replace(/[\s']/g, "");
  if (compact.startsWith("+")) compact = compact.slice(1);
  if (compact === "" || compact.startsWith("-")) return null;

  const commaCount = (compact.match(/,/g) ?? []).length;
  const dotCount = (compact.match(/\./g) ?? []).length;
  let normalized = compact;

  if (commaCount > 0 && dotCount > 0) {
    const commaIsDecimal = compact.lastIndexOf(",") > compact.lastIndexOf(".");
    const decimalSeparator = commaIsDecimal ? "," : ".";
    const groupingSeparator = commaIsDecimal ? "." : ",";
    if ((compact.match(new RegExp(`\\${decimalSeparator}`, "g")) ?? []).length !== 1) {
      return null;
    }
    normalized = compact.replaceAll(groupingSeparator, "").replace(decimalSeparator, ".");
  } else if (commaCount > 0) {
    if (commaCount !== 1) return null;
    normalized = compact.replace(",", ".");
  } else if (dotCount > 1) {
    const groups = compact.split(".");
    if (groups.some((group) => group === "") || groups.slice(1).some((group) => group.length !== 3)) {
      return null;
    }
    normalized = groups.join("");
  }

  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) return null;
  const integer = (match[1] ?? "").replace(/^0+(?=\d)/, "");
  const fraction = match[2];
  const result = fraction === undefined ? integer : `${integer}.${fraction}`;
  return /[1-9]/.test(result) ? result : null;
}

export function isPositiveDecimal(value: MoneyString): boolean {
  return positiveDecimalString(value) !== null;
}

/** Like positiveDecimalString but also accepts an empty field or an explicit zero, returning "0". */
export function nonNegativeDecimalString(value: string): MoneyString | null {
  const compact = value.trim().replace(/[\s']/g, "");
  if (compact === "" || /^0([.,]0+)?$/.test(compact)) return "0";
  return positiveDecimalString(value);
}
