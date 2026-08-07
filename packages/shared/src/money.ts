const MONEY_PATTERN = /^(0|[1-9]\d{0,13})(\.\d{1,6})?$/;

/** Fixed scale money for validation/comparison only. Persisted arithmetic remains PostgreSQL NUMERIC. */
export class Money {
  private constructor(readonly minor: bigint) {}

  static parse(value: string): Money {
    if (!MONEY_PATTERN.test(value)) throw new Error("Money must be a positive decimal string with at most 6 fraction digits");
    const [whole, fraction = ""] = value.split(".");
    return new Money(BigInt(whole) * 1_000_000n + BigInt(fraction.padEnd(6, "0")));
  }

  add(other: Money): Money { return new Money(this.minor + other.minor); }
  subtract(other: Money): Money { return new Money(this.minor - other.minor); }
  equals(other: Money): boolean { return this.minor === other.minor; }
  isPositive(): boolean { return this.minor > 0n; }
  toString(): string {
    const sign = this.minor < 0n ? "-" : "";
    const absolute = this.minor < 0n ? -this.minor : this.minor;
    const whole = absolute / 1_000_000n;
    const fraction = (absolute % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
    return `${sign}${whole}${fraction ? `.${fraction}` : ""}`;
  }
}

