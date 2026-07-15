import { createHash } from "node:crypto";
import type { Money } from "../../../money/types.js";
import type { CalculatedDistribution, CalculatedDistributionEntry } from "../../../distribution/types.js";
import {
  moneyToMercadoPagoAmount,
  percentageBpsToMercadoPagoAmount,
} from "../money-mapper.js";
import type {
  MpOrderCreateRequest,
  MpOrderResponse,
  MpOrderAmountType,
} from "./contracts.js";
import type { SplitOrderEntry } from "./validator.js";

export type MappedOrderStatus =
  | "OPEN"
  | "PROCESSED_ACCREDITED"
  | "PROCESSED"
  | "REFUNDED"
  | "CHARGED_BACK"
  | "FAILED"
  | "CANCELED"
  | string;

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(record).sort()) {
      sorted[key] = sortKeysDeep(record[key]);
    }
    return sorted;
  }
  return value;
}

export function stablePayloadHash(payload: unknown): string {
  const normalized = JSON.stringify(sortKeysDeep(payload));
  return createHash("sha256").update(normalized).digest("hex");
}

export function inferAmountType(distribution: CalculatedDistribution): MpOrderAmountType {
  const hasPercentage = distribution.entries.some(
    (e: CalculatedDistributionEntry) => e.ruleKind === "PERCENTAGE",
  );
  return hasPercentage ? "percentage" : "fixed";
}

function amountToBps(amount: Money, total: Money): number {
  if (total.amountMinor === 0n) return 0;
  return Number((amount.amountMinor * 10_000n) / total.amountMinor);
}

export function buildSplitEntriesFromDistribution(
  distribution: CalculatedDistribution,
  ownerUserId: string,
  partnerReceiverIds: Map<string, string>,
): SplitOrderEntry[] {
  const amountType = inferAmountType(distribution);
  const partners: SplitOrderEntry[] = [];
  let ownerAmountMinor = 0n;
  let ownerBps = 10_000;

  for (const entry of distribution.entries) {
    const receiverId = partnerReceiverIds.get(entry.recipientId);
    if (receiverId) {
      if (amountType === "fixed") {
        partners.push({
          receiverType: "partner",
          receiverId,
          consentStatus: "ACTIVE",
          amount: entry.amount,
        });
      } else {
        const bps = amountToBps(entry.amount, distribution.total);
        ownerBps -= bps;
        partners.push({
          receiverType: "partner",
          receiverId,
          consentStatus: "ACTIVE",
          amountBps: bps,
        });
      }
    } else {
      ownerAmountMinor += entry.amount.amountMinor;
    }
  }

  const ownerEntry: SplitOrderEntry =
    amountType === "fixed"
      ? {
          receiverType: "owner",
          receiverId: ownerUserId,
          amount: {
            currency: distribution.total.currency,
            amountMinor: ownerAmountMinor,
          },
        }
      : {
          receiverType: "owner",
          receiverId: ownerUserId,
          amountBps: ownerBps,
        };

  return [ownerEntry, ...partners];
}

export function buildMercadoPagoSplitOrderRequest(opts: {
  externalReference: string;
  total: Money;
  amountType: MpOrderAmountType;
  entries: SplitOrderEntry[];
  deviceSessionId: string;
  payerEmail?: string;
  metadata?: Record<string, string>;
  description?: string;
  paymentToken?: string;
  installments?: number;
  integratorId?: string;
  platformId?: string;
}): {
  body: MpOrderCreateRequest;
  headers: Record<string, string>;
  payloadHash: string;
} {
  const splits = opts.entries.map((entry) => {
    const amount =
      opts.amountType === "fixed"
        ? moneyToMercadoPagoAmount(entry.amount!)
        : percentageBpsToMercadoPagoAmount(entry.amountBps!);

    return {
      receiver_id: entry.receiverId,
      receiver_type: entry.receiverType,
      amount,
      description: entry.receiverType === "owner" ? "owner" : "partner",
    };
  });

  const totalAmount = moneyToMercadoPagoAmount(opts.total);
  const body: MpOrderCreateRequest = {
    type: "online",
    external_reference: opts.externalReference,
    total_amount: totalAmount,
    processing_mode: "automatic",
    splits,
    config: {
      split_rules: {
        amount_type: opts.amountType,
      },
    },
  };
  if (opts.payerEmail) {
    body.payer = { email: opts.payerEmail };
  }
  if (opts.integratorId || opts.platformId) {
    body.integration_data = {
      ...(opts.integratorId ? { integrator_id: opts.integratorId } : {}),
      ...(opts.platformId ? { platform_id: opts.platformId } : {}),
    };
  }

  if (opts.paymentToken) {
    body.transactions = {
      payments: [
        {
          amount: totalAmount,
          payment_method: {
            token: opts.paymentToken,
            type: "credit_card",
            installments: opts.installments ?? 1,
          },
        },
      ],
    };
  }

  const headers: Record<string, string> = {
    "x-meli-session-id": opts.deviceSessionId,
  };

  return {
    body,
    headers,
    payloadHash: stablePayloadHash({ body, headers }),
  };
}

export function mapMercadoPagoOrderStatus(
  orderStatus: string,
  statusDetailOrPaymentStatus?: string,
  paymentStatusDetail?: string,
): MappedOrderStatus {
  const normalizedOrder = orderStatus.toLowerCase();
  const detail = (statusDetailOrPaymentStatus ?? paymentStatusDetail ?? "").toLowerCase();

  if (normalizedOrder === "open" && (detail === "waiting_payment" || detail === "")) {
    return "OPEN";
  }
  if (normalizedOrder === "open") {
    return "OPEN";
  }
  if (normalizedOrder === "processed" && detail === "accredited") {
    return "PROCESSED_ACCREDITED";
  }
  if (normalizedOrder === "processed") {
    return "PROCESSED";
  }
  if (normalizedOrder === "refunded") return "REFUNDED";
  if (normalizedOrder === "charged_back") return "CHARGED_BACK";
  if (normalizedOrder === "failed") return "FAILED";
  if (normalizedOrder === "canceled" || normalizedOrder === "cancelled") return "CANCELED";

  return `UNKNOWN:${orderStatus}:${statusDetailOrPaymentStatus ?? ""}`;
}

export function mapMercadoPagoOrderResponse(order: MpOrderResponse): {
  providerOrderId: string;
  status: MappedOrderStatus;
  statusDetail?: string;
  payments: Array<{ providerPaymentId: string; status: string; amount: Money }>;
} {
  const paymentsRaw = order.transactions?.payments ?? [];
  const primaryPayment = paymentsRaw[0];
  const status = mapMercadoPagoOrderStatus(
    order.status,
    order.status_detail ?? primaryPayment?.status,
    primaryPayment?.status_detail,
  );

  const currency = (order.currency ?? "ARS") as Money["currency"];
  const payments = paymentsRaw.map((p) => ({
    providerPaymentId: p.id,
    status: p.status,
    amount: {
      currency,
      amountMinor: parseMpAmountToMinor(p.paid_amount ?? p.amount ?? "0", currency),
    },
  }));

  const detail = order.status_detail ?? primaryPayment?.status_detail;
  return {
    providerOrderId: order.id,
    status,
    payments,
    ...(detail ? { statusDetail: detail } : {}),
  };
}

function parseMpAmountToMinor(amount: string, currency: string): bigint {
  const scale = currency === "CLP" ? 0 : 2;
  const parts = amount.split(".");
  const whole = parts[0] ?? "0";
  const frac = parts[1] ?? "";
  const paddedFrac = frac.padEnd(scale, "0").slice(0, scale);
  const minorStr = scale === 0 ? whole : `${whole}${paddedFrac}`;
  const cleaned = minorStr.replace(/[^0-9-]/g, "") || "0";
  return BigInt(cleaned);
}
