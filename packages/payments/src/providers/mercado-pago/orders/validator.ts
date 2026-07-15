import type { Money } from "../../../money/types.js";
import type { SplitConsentStatus } from "../../../contracts/entities.js";
import { moneyToMercadoPagoAmount } from "../money-mapper.js";
import { OrderValidationError } from "./errors.js";

export type SplitAmountType = "fixed" | "percentage";

export interface SplitOrderEntry {
  receiverType: "owner" | "partner";
  receiverId: string;
  consentStatus?: SplitConsentStatus;
  /** For fixed: Money amount; for percentage: bps in amountBps */
  amount?: Money;
  amountBps?: number;
}

export interface ValidateSplitOrderInput {
  total: Money;
  amountType: SplitAmountType;
  entries: SplitOrderEntry[];
  deviceSessionId: string;
  maxSellers?: number;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function validateSplitOrderForMercadoPago(input: ValidateSplitOrderInput): void {
  const maxSellers = input.maxSellers ?? 20;

  if (!input.deviceSessionId || input.deviceSessionId.trim().length === 0) {
    throw new OrderValidationError("deviceSessionId is required and must be non-empty");
  }

  const owners = input.entries.filter((e) => e.receiverType === "owner");
  const partners = input.entries.filter((e) => e.receiverType === "partner");

  if (owners.length !== 1) {
    throw new OrderValidationError(`Expected exactly one owner, got ${owners.length}`);
  }

  if (partners.length < 1) {
    throw new OrderValidationError("At least one partner is required");
  }

  if (input.entries.length > maxSellers + 1) {
    throw new OrderValidationError(`Maximum ${maxSellers} partners exceeded`);
  }

  for (const entry of partners) {
    if (!isUuid(entry.receiverId)) {
      throw new OrderValidationError(`Partner receiverId must be UUID: ${entry.receiverId}`);
    }
    if (entry.consentStatus !== "ACTIVE") {
      throw new OrderValidationError(
        `Partner ${entry.receiverId} requires ACTIVE consent, got ${entry.consentStatus ?? "undefined"}`,
      );
    }
  }

  if (input.amountType === "fixed") {
    let sumMinor = 0n;
    for (const entry of input.entries) {
      if (!entry.amount) {
        throw new OrderValidationError(`Fixed amount required for ${entry.receiverId}`);
      }
      if (entry.amount.currency !== input.total.currency) {
        throw new OrderValidationError("All amounts must match order currency");
      }
      sumMinor += entry.amount.amountMinor;
    }
    const totalStr = moneyToMercadoPagoAmount(input.total);
    const sumStr = moneyToMercadoPagoAmount({
      currency: input.total.currency,
      amountMinor: sumMinor,
    });
    if (totalStr !== sumStr) {
      throw new OrderValidationError(
        `Fixed split amounts must equal total: expected ${totalStr}, got ${sumStr}`,
      );
    }
  } else {
    let sumBps = 0;
    for (const entry of input.entries) {
      if (entry.amountBps === undefined) {
        throw new OrderValidationError(`Percentage bps required for ${entry.receiverId}`);
      }
      sumBps += entry.amountBps;
    }
    if (sumBps !== 10_000) {
      throw new OrderValidationError(
        `Percentage splits must sum to 10000 bps (100%), got ${sumBps}`,
      );
    }
  }
}
