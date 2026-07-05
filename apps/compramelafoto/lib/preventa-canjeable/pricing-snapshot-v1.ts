/**
 * pricingSnapshot V1 — claves raíz / lines[] según docs/PREVENTA-CANJEABLE-SPEC-TECNICA.md §1.8.1
 * Sin acoplar al checkout: solo construcción, merge y validación mínima.
 */

import {
  CHECKOUT_PAYMENT_SOURCE_JSON,
  ORDER_ITEM_LINE_ORIGIN_JSON,
  ORDER_ORIGIN_JSON,
  type OrderItemLineOriginJson,
} from "./constants";

export type PricingSnapshotV1Line = {
  orderItemId: number | null;
  lineOrigin: OrderItemLineOriginJson;
  basePriceArs: number;
  feeArs: number;
  clientPaysArs: number;
  coveredByPack: boolean;
};

export type StandardAlbumCheckoutLineInput = {
  subtotalCents: number;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

const CHECKOUT_VALUES = new Set<string>(Object.values(CHECKOUT_PAYMENT_SOURCE_JSON));
const ORIGIN_VALUES = new Set<string>(Object.values(ORDER_ORIGIN_JSON));
const LINE_ORIGIN_VALUES = new Set<string>(Object.values(ORDER_ITEM_LINE_ORIGIN_JSON));

/**
 * Valida forma mínima §1.8.1 para escrituras nuevas. No valida claves legacy extra del motor de precios.
 */
export function validatePricingSnapshotV1Minimal(
  value: unknown
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  if (!isRecord(value)) {
    return { ok: false, errors: ["root_not_object"] };
  }
  if (value.schemaVersion !== 1) {
    errors.push("schemaVersion_must_be_1");
  }
  const cps = value.checkoutPaymentSource;
  if (typeof cps !== "string" || !CHECKOUT_VALUES.has(cps)) {
    errors.push("checkoutPaymentSource_invalid");
  }
  const origin = value.origin;
  if (typeof origin !== "string" || !ORIGIN_VALUES.has(origin)) {
    errors.push("origin_invalid");
  }
  if (!Array.isArray(value.lines)) {
    errors.push("lines_must_be_array");
  } else {
    value.lines.forEach((line, i) => {
      if (!isRecord(line)) {
        errors.push(`lines[${i}]_not_object`);
        return;
      }
      const lo = line.lineOrigin;
      if (typeof lo !== "string" || !LINE_ORIGIN_VALUES.has(lo)) {
        errors.push(`lines[${i}].lineOrigin_invalid`);
      }
      for (const k of ["basePriceArs", "feeArs", "clientPaysArs"] as const) {
        if (typeof line[k] !== "number" || !Number.isFinite(line[k])) {
          errors.push(`lines[${i}].${k}_invalid`);
        }
      }
      if (typeof line.coveredByPack !== "boolean") {
        errors.push(`lines[${i}].coveredByPack_invalid`);
      }
      if (line.orderItemId != null && typeof line.orderItemId !== "number") {
        errors.push(`lines[${i}].orderItemId_invalid`);
      }
      if (
        typeof lo === "string" &&
        LINE_ORIGIN_VALUES.has(lo) &&
        typeof line.coveredByPack === "boolean"
      ) {
        const mustCover = lo === ORDER_ITEM_LINE_ORIGIN_JSON.PACK_INCLUDED;
        if (line.coveredByPack !== mustCover) {
          errors.push(`lines[${i}].coveredByPack_inconsistent_with_lineOrigin`);
        }
      }
    });
  }

  if (value.origin === ORDER_ORIGIN_JSON.PACK_REDEMPTION) {
    if (!("preCompraOrderId" in value)) errors.push("missing_preCompraOrderId");
    else if (value.preCompraOrderId != null && typeof value.preCompraOrderId !== "number") {
      errors.push("preCompraOrderId_invalid");
    }
    if (!("entitlementId" in value)) errors.push("missing_entitlementId");
    else if (value.entitlementId != null && typeof value.entitlementId !== "number") {
      errors.push("entitlementId_invalid");
    }
    if (typeof value.preventaCoversAll !== "boolean") errors.push("preventaCoversAll_invalid");
    if (typeof value.feePackPrepaid !== "boolean") errors.push("feePackPrepaid_invalid");
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * Reparte marketplaceFeeCents entre líneas proporcionalmente al subtotal (columnas *Cents = ARS enteros).
 */
export function allocateFeeAcrossLines(
  subtotals: number[],
  marketplaceFeeCents: number
): number[] {
  const fee = Math.round(Number(marketplaceFeeCents) || 0);
  const sum = subtotals.reduce((a, b) => a + Math.max(0, b), 0);
  if (sum <= 0 || fee <= 0) return subtotals.map(() => 0);
  const raw = subtotals.map((s) => (Math.max(0, s) / sum) * fee);
  const floors = raw.map((x) => Math.floor(x));
  let rem = fee - floors.reduce((a, b) => a + b, 0);
  const idx = raw
    .map((x, i) => ({ i, frac: x - floors[i] }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  let k = 0;
  while (rem > 0 && k < idx.length) {
    out[idx[k].i] += 1;
    rem -= 1;
    k += 1;
  }
  return out;
}

export function buildStandardLinesFromAlbumCheckout(
  items: StandardAlbumCheckoutLineInput[],
  marketplaceFeeCents: number
): PricingSnapshotV1Line[] {
  const subtotals = items.map((i) => Math.round(Number(i.subtotalCents) || 0));
  const feePerLine = allocateFeeAcrossLines(subtotals, marketplaceFeeCents);
  return subtotals.map((clientPaysArs, i) => {
    const feeArs = feePerLine[i] ?? 0;
    const basePriceArs = Math.max(0, clientPaysArs - feeArs);
    return {
      orderItemId: null,
      lineOrigin: ORDER_ITEM_LINE_ORIGIN_JSON.STANDARD,
      basePriceArs,
      feeArs,
      clientPaysArs,
      coveredByPack: false,
    };
  });
}

/**
 * Fusiona snapshot del pricing-engine con contrato V1 (checkout estándar álbum + MP).
 * Conserva claves legacy del engine; añade/ sobrescribe solo las raíz §1.8.1 listadas.
 */
export function mergeStandardAlbumCheckoutPricingSnapshotV1(
  engineSnapshot: Record<string, unknown>,
  args: {
    marketplaceFeeCents: number;
    displayTotalCents: number;
    lines: PricingSnapshotV1Line[];
  }
): Record<string, unknown> {
  return {
    ...engineSnapshot,
    schemaVersion: 1,
    checkoutPaymentSource: CHECKOUT_PAYMENT_SOURCE_JSON.MERCADO_PAGO,
    origin: ORDER_ORIGIN_JSON.STANDARD_CHECKOUT,
    lines: args.lines,
    preCompraOrderId: null,
    entitlementId: null,
    preventaCoversAll: false,
    feePackPrepaid: false,
    totalClientPaidArs: Math.round(Number(args.displayTotalCents) || 0),
    currency: "ARS",
  };
}
