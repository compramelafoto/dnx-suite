import type { CurrencyCode } from "../contracts/primitives.js";
import type { Money, Percentage } from "./types.js";

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MoneyError";
  }
}

function assertIntegerMinor(amountMinor: bigint): void {
  // bigint is always integer; reject negative zero edge via explicit checks elsewhere
  void amountMinor;
}

export function money(currency: CurrencyCode, amountMinor: bigint | number | string): Money {
  let value: bigint;
  if (typeof amountMinor === "bigint") {
    value = amountMinor;
  } else if (typeof amountMinor === "number") {
    if (!Number.isInteger(amountMinor)) {
      throw new MoneyError(`amountMinor must be an integer, got float ${amountMinor}`);
    }
    if (!Number.isSafeInteger(amountMinor)) {
      throw new MoneyError(`amountMinor ${amountMinor} is not a safe integer; use bigint`);
    }
    value = BigInt(amountMinor);
  } else {
    if (!/^-?\d+$/.test(amountMinor.trim())) {
      throw new MoneyError(`invalid amountMinor string: ${amountMinor}`);
    }
    value = BigInt(amountMinor.trim());
  }
  assertIntegerMinor(value);
  return { currency, amountMinor: value };
}

export function assertSameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new MoneyError(`currency mismatch: ${a.currency} vs ${b.currency}`);
  }
}

export function addMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { currency: a.currency, amountMinor: a.amountMinor + b.amountMinor };
}

export function subtractMoney(a: Money, b: Money): Money {
  assertSameCurrency(a, b);
  return { currency: a.currency, amountMinor: a.amountMinor - b.amountMinor };
}

export function sumMoney(items: Money[], currency: CurrencyCode): Money {
  let total = 0n;
  for (const item of items) {
    if (item.currency !== currency) {
      throw new MoneyError(`currency mismatch in sum: expected ${currency}, got ${item.currency}`);
    }
    total += item.amountMinor;
  }
  return { currency, amountMinor: total };
}

export function isPositive(m: Money): boolean {
  return m.amountMinor > 0n;
}

export function isZero(m: Money): boolean {
  return m.amountMinor === 0n;
}

export function percentageFromBps(bps: number): Percentage {
  if (!Number.isInteger(bps)) {
    throw new MoneyError(`percentage bps must be integer, got ${bps}`);
  }
  if (bps < 0 || bps > 10_000) {
    throw new MoneyError(`percentage bps out of range 0..10000: ${bps}`);
  }
  return { bps };
}

/** Floor division of amount by bps/10000. */
export function shareByBps(total: Money, bps: number): Money {
  percentageFromBps(bps);
  return {
    currency: total.currency,
    amountMinor: (total.amountMinor * BigInt(bps)) / 10_000n,
  };
}

export function moneyToJson(m: Money): { currency: CurrencyCode; amountMinor: string } {
  return { currency: m.currency, amountMinor: m.amountMinor.toString() };
}

export function moneyFromJson(raw: { currency: CurrencyCode; amountMinor: string }): Money {
  return money(raw.currency, raw.amountMinor);
}
