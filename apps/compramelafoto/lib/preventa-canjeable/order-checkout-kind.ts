import { OrderOrigin } from "@/lib/prisma";

/**
 * Vista humana / metadata MP alineada al modelo V1 (sin columna duplicada en DB).
 * Mapeo 1:1 con Order.origin.
 */
export type OrderCheckoutKind = "DIRECT" | "PREVENTA_PACK" | "REDEMPTION";

export function checkoutKindFromOrderOrigin(origin: OrderOrigin): OrderCheckoutKind {
  switch (origin) {
    case OrderOrigin.STANDARD_CHECKOUT:
      return "DIRECT";
    case OrderOrigin.PREVENTA_PACK:
      return "PREVENTA_PACK";
    case OrderOrigin.PACK_REDEMPTION:
      return "REDEMPTION";
    default:
      return "DIRECT";
  }
}

/** Claves en Order.pricingSnapshot para sellado del pack al cobrar (MP webhook). */
export type PreventaPackPricingSnapshotV1 = {
  packDefinitionId: number;
};

export function readPackDefinitionIdFromOrderPricingSnapshot(
  pricingSnapshot: unknown
): number | null {
  if (pricingSnapshot == null || typeof pricingSnapshot !== "object") return null;
  const o = pricingSnapshot as Record<string, unknown>;
  const nested = o.preventaPackV1;
  if (nested != null && typeof nested === "object") {
    const id = Number((nested as Record<string, unknown>).packDefinitionId);
    if (Number.isInteger(id) && id > 0) return id;
  }
  const root = Number(o.packDefinitionId);
  if (Number.isInteger(root) && root > 0) return root;
  return null;
}

export function readPackDefinitionIdFromPaymentMetadata(
  metadata: Record<string, unknown> | undefined
): number | null {
  if (!metadata) return null;
  const raw = metadata.packDefinitionId ?? metadata.preventaPackDefinitionId;
  const id = typeof raw === "string" ? Number(raw) : Number(raw);
  if (Number.isInteger(id) && id > 0) return id;
  return null;
}
