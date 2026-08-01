import type { Money } from "../../../money/types.js";
import type { SplitConsentStatus } from "../../../contracts/entities.js";
import { moneyToMercadoPagoAmount } from "../money-mapper.js";
import { OrderValidationError } from "./errors.js";
import {
  MERCADO_PAGO_FORBIDDEN_DEVICE_SESSION_PLACEHOLDERS,
  MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS,
} from "./constants.js";
import { normalizePayerEmail } from "./payer.js";
import { resolveStatementDescriptor } from "./statement-descriptor.js";
import { assertOpaqueExternalReference } from "./external-reference.js";
import {
  validateOrderItems,
  type OrderItemInput,
  type ItemsTotalRelation,
} from "./order-items.js";
import {
  assertPartnerConsentsForSplitOrder,
  type PartnerConsentEvidence,
} from "./consent-evidence.js";

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
  /** @deprecated use max from MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS; override only in tests */
  maxSellers?: number;
  allowTestDevicePlaceholders?: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

export function assertDeviceSessionId(
  deviceSessionId: string | undefined | null,
  opts?: { allowTestDevicePlaceholders?: boolean },
): string {
  if (!deviceSessionId || deviceSessionId.trim().length === 0) {
    throw new OrderValidationError(
      "DEVICE_SESSION_REQUIRED: deviceSessionId / x-meli-session-id is required",
    );
  }
  const value = deviceSessionId.trim();
  const forbidden = MERCADO_PAGO_FORBIDDEN_DEVICE_SESSION_PLACEHOLDERS as readonly string[];
  if (!opts?.allowTestDevicePlaceholders && forbidden.includes(value)) {
    throw new OrderValidationError(
      "DEVICE_SESSION_INVALID: placeholder deviceSessionId is not allowed (DEVICE CONTEXT FRONTEND BLOCKED UNTIL BRICK unless test fixtures)",
    );
  }
  return value;
}

/**
 * Legacy/split-entry math validation (owner + partners + sum).
 * Prefer `validateMercadoPagoSplitOrder` for the full pre-POST gate.
 */
export function validateSplitOrderForMercadoPago(input: ValidateSplitOrderInput): void {
  const maxSellers = input.maxSellers ?? MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS;
  assertDeviceSessionId(input.deviceSessionId, {
    allowTestDevicePlaceholders: input.allowTestDevicePlaceholders ?? true,
  });

  const owners = input.entries.filter((e) => e.receiverType === "owner");
  const partners = input.entries.filter((e) => e.receiverType === "partner");

  if (owners.length !== 1) {
    throw new OrderValidationError(`Expected exactly one owner, got ${owners.length}`);
  }

  // 0 partners allowed for internal owner-only cases; MP Split 1:N consumers usually send ≥1.
  if (partners.length > maxSellers) {
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

export interface ValidateMercadoPagoSplitOrderInput {
  externalReference: string;
  total: Money;
  amountType: SplitAmountType;
  entries: SplitOrderEntry[];
  deviceSessionId: string;
  payerEmail: string;
  statementDescriptor?: string | null;
  defaultStatementDescriptor?: string | null;
  items: OrderItemInput[];
  itemsTotalRelation?: ItemsTotalRelation;
  partnerReceiverIds: Map<string, string>;
  partnerConsentsByRecipientId: Map<string, PartnerConsentEvidence>;
  ownerUserId: string;
  now?: Date;
  allowTestFixtures?: boolean;
  maxPartners?: number;
}

export interface ValidateMercadoPagoSplitOrderResult {
  externalReference: string;
  payerEmail: string;
  statementDescriptor: string;
  deviceSessionId: string;
}

/**
 * Canonical pre-Order validation before any Mercado Pago write (POST /v1/orders).
 * Pure aside from `now` for consent expiry.
 */
export function validateMercadoPagoSplitOrder(
  input: ValidateMercadoPagoSplitOrderInput,
): ValidateMercadoPagoSplitOrderResult {
  const maxPartners = input.maxPartners ?? MERCADO_PAGO_SPLIT_1N_MAX_PARTNERS;
  const allowTestFixtures = input.allowTestFixtures ?? false;

  if (!input.ownerUserId?.trim()) {
    throw new OrderValidationError("OWNER_REQUIRED: ownerUserId is required");
  }

  const externalReference = assertOpaqueExternalReference(input.externalReference);
  const payerEmail = normalizePayerEmail(input.payerEmail);
  const statementDescriptor = resolveStatementDescriptor({
    statementDescriptor: input.statementDescriptor,
    defaultStatementDescriptor: input.defaultStatementDescriptor,
  });
  const deviceSessionId = assertDeviceSessionId(input.deviceSessionId, {
    allowTestDevicePlaceholders: allowTestFixtures,
  });

  validateOrderItems({
    items: input.items,
    orderTotal: input.total,
    itemsTotalRelation: input.itemsTotalRelation ?? "informative",
    requireAtLeastOne: true,
  });

  assertPartnerConsentsForSplitOrder({
    partnerReceiverIds: input.partnerReceiverIds,
    partnerConsentsByRecipientId: input.partnerConsentsByRecipientId,
    ...(input.now ? { now: input.now } : {}),
    allowTestFixtures,
  });

  validateSplitOrderForMercadoPago({
    total: input.total,
    amountType: input.amountType,
    entries: input.entries,
    deviceSessionId,
    maxSellers: maxPartners,
    allowTestDevicePlaceholders: allowTestFixtures,
  });

  return {
    externalReference,
    payerEmail,
    statementDescriptor,
    deviceSessionId,
  };
}
