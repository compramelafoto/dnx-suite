import type { CurrencyCode } from "../contracts/primitives";

/**
 * Money is always integer minor units (centavos, cents, …).
 * Never use IEEE floats for amounts.
 */
export interface Money {
  currency: CurrencyCode;
  /** Integer minor units. */
  amountMinor: bigint;
}

/** Basis points: 10000 = 100%. */
export interface Percentage {
  bps: number;
}

export interface Fee {
  label: string;
  amount: Money;
  /** Allocation may be unknown until MP confirms. */
  allocation: "WAITING_MP_CONFIRMATION" | "PLATFORM" | "PROPORTIONAL" | "OWNER" | "UNKNOWN";
}

export interface DistributionAmount {
  recipientId: string;
  amount: Money;
}
