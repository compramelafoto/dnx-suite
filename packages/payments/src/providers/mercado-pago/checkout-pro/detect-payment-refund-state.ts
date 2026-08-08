/**
 * Detecta reembolso total/parcial desde la respuesta S2S de un pago MP.
 * No confía en un status literal "refunded": compara importes en minor units (bigint).
 */
import type { CurrencyCode } from "../../../contracts/primitives.js";
import { money } from "../../../money/money.js";
import type { NormalizedCheckoutStatus } from "../../../application/services/clickaton-checkout/types.js";
import { mapMercadoPagoPaymentStatusToNormalized } from "./map-status.js";

export type MpPaymentRefundDetection = {
  status: NormalizedCheckoutStatus;
  amountMinor: number;
  refundedAmountMinor: number;
  netAmountMinor: number;
  providerPaymentId: string;
  providerRefundIds: string[];
  statusDetail: string | null;
  kind: "none" | "partial" | "total";
};

function currencyScale(currency: CurrencyCode): number {
  return currency === "CLP" ? 0 : 2;
}

/** Convierte decimal MP (number|string) a minor units sin floats inseguros. */
export function mpUnitAmountToMinor(
  value: unknown,
  currency: CurrencyCode,
): bigint {
  if (value == null) return 0n;
  if (typeof value === "bigint") return value < 0n ? 0n : value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) return 0n;
    const scale = currencyScale(currency);
    if (scale === 0) return BigInt(Math.round(value));
    // Evitar float: redondear a centavos vía toFixed + parse.
    const fixed = value.toFixed(scale);
    return mpDecimalStringToMinor(fixed, currency);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0n;
    return mpDecimalStringToMinor(trimmed, currency);
  }
  return 0n;
}

function mpDecimalStringToMinor(raw: string, currency: CurrencyCode): bigint {
  const scale = currencyScale(currency);
  const negative = raw.startsWith("-");
  const s = negative ? raw.slice(1) : raw;
  if (!/^\d+(\.\d+)?$/.test(s)) return 0n;
  const [wholePart, fracPart = ""] = s.split(".");
  if (scale === 0) {
    const v = BigInt(wholePart ?? "0");
    return negative ? -v : v;
  }
  const frac = (fracPart + "0".repeat(scale)).slice(0, scale);
  const v = BigInt(wholePart ?? "0") * 10n ** BigInt(scale) + BigInt(frac || "0");
  return negative ? -v : v;
}

function extractRefundIds(raw: Record<string, unknown>): string[] {
  const ids = new Set<string>();
  const refunds = raw.refunds;
  if (Array.isArray(refunds)) {
    for (const row of refunds) {
      if (!row || typeof row !== "object") continue;
      const id = (row as { id?: unknown }).id;
      if (id != null && String(id).trim()) ids.add(String(id));
    }
  }
  return [...ids];
}

function sumRefundsArrayMinor(
  raw: Record<string, unknown>,
  currency: CurrencyCode,
): bigint {
  const refunds = raw.refunds;
  if (!Array.isArray(refunds)) return 0n;
  let total = 0n;
  for (const row of refunds) {
    if (!row || typeof row !== "object") continue;
    const amount = (row as { amount?: unknown }).amount;
    total += mpUnitAmountToMinor(amount, currency);
  }
  return total < 0n ? 0n : total;
}

/**
 * Determina el estado normalizado de cobro a partir del body S2S de MP Payments API.
 */
export function detectPaymentRefundState(input: {
  raw: Record<string, unknown>;
  fallbackPaymentId?: string;
}): MpPaymentRefundDetection {
  const raw = input.raw;
  const currency = (String(raw.currency_id ?? "ARS") as CurrencyCode) || "ARS";
  const amountMinorBig = mpUnitAmountToMinor(raw.transaction_amount, currency);
  const fromField = mpUnitAmountToMinor(raw.transaction_amount_refunded, currency);
  const fromArray = sumRefundsArrayMinor(raw, currency);
  const refundedAmountMinorBig =
    fromField >= fromArray ? fromField : fromArray;

  const providerPaymentId = String(raw.id ?? input.fallbackPaymentId ?? "");
  const statusDetail =
    typeof raw.status_detail === "string" ? raw.status_detail : null;
  const statusFromMp = mapMercadoPagoPaymentStatusToNormalized(
    String(raw.status ?? ""),
  );
  const providerRefundIds = extractRefundIds(raw);

  const amount = money(currency, amountMinorBig);
  const refunded = money(currency, refundedAmountMinorBig);
  const cappedRefunded =
    refunded.amountMinor > amount.amountMinor
      ? amount
      : refunded;
  const netMinor = amount.amountMinor - cappedRefunded.amountMinor;

  let kind: MpPaymentRefundDetection["kind"] = "none";
  let status: NormalizedCheckoutStatus = statusFromMp;

  if (amount.amountMinor > 0n && cappedRefunded.amountMinor >= amount.amountMinor) {
    kind = "total";
    status = "REFUNDED";
  } else if (cappedRefunded.amountMinor > 0n) {
    kind = "partial";
    status = "PARTIALLY_REFUNDED";
  } else if (statusFromMp === "REFUNDED") {
    kind = "total";
    status = "REFUNDED";
  } else if (
    statusDetail === "partially_refunded" ||
    statusDetail === "partial_refunded"
  ) {
    kind = "partial";
    status = "PARTIALLY_REFUNDED";
  }

  return {
    status,
    amountMinor: Number(amount.amountMinor),
    refundedAmountMinor: Number(cappedRefunded.amountMinor),
    netAmountMinor: Number(netMinor),
    providerPaymentId,
    providerRefundIds,
    statusDetail,
    kind,
  };
}
