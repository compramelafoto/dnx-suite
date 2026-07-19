import { conceptualAvailable, conceptualVariantStock } from "../design/contracts";
import type { AvailabilityRecord, VariantStockView } from "./types";

export { conceptualAvailable, conceptualVariantStock };

export function salesStatusOf(input: {
  isActive: boolean;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  now?: Date;
}): AvailabilityRecord["salesStatus"] {
  if (!input.isActive) return "inactive";
  const now = input.now ?? new Date();
  if (input.salesStartAt && input.salesStartAt.getTime() > now.getTime()) return "not_started";
  if (input.salesEndAt && input.salesEndAt.getTime() < now.getTime()) return "ended";
  return "open";
}

export function buildAvailability(input: {
  ticketTypeId: string;
  capacity: number | null;
  confirmedCount: number;
  activeHoldCount: number;
  waitlistedCount: number;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
  isActive: boolean;
  now?: Date;
}): AvailabilityRecord {
  const snap = conceptualAvailable({
    capacity: input.capacity,
    confirmedCount: input.confirmedCount,
    activeHoldCount: input.activeHoldCount,
  });
  return {
    ticketTypeId: input.ticketTypeId,
    capacity: snap.capacity,
    confirmedCount: snap.confirmedCount,
    activeHoldCount: snap.activeHoldCount,
    available: snap.available,
    isUnlimited: snap.isUnlimited,
    isSoldOut: snap.isSoldOut,
    waitlistedCount: input.waitlistedCount,
    salesStartAt: input.salesStartAt,
    salesEndAt: input.salesEndAt,
    isActive: input.isActive,
    salesStatus: salesStatusOf(input),
  };
}

/**
 * Stock MVP: fuente principal = reservedStock persistido.
 * activeHoldQuantity es diagnóstico; no se resta otra vez (evita doble conteo).
 */
export function buildVariantStockView(input: {
  variantId: string;
  stock: number;
  reservedStock: number;
  activeHoldQuantity: number;
}): VariantStockView {
  const snap = conceptualVariantStock(input.stock, input.reservedStock);
  return {
    variantId: input.variantId,
    stock: snap.stock,
    reservedStock: snap.reservedStock,
    availableStock: snap.availableStock,
    activeHoldQuantity: input.activeHoldQuantity,
    isSoldOut: snap.availableStock === 0,
  };
}
