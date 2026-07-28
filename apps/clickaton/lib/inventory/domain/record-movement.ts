/**
 * Registro idempotente de movimientos de inventario.
 * El stock físico sigue en ClickatonProductVariant.stock / reservedStock;
 * este ledger audita holds, confirmaciones, ajustes y (futuro) tienda.
 */

import type { InventoryMovementType } from "@/lib/catalog/domain/types";

export type InventoryMovementInput = {
  productId: string;
  variantId?: string | null;
  movementType: InventoryMovementType;
  quantity: number;
  sourceType: string;
  sourceId: string;
  reason?: string | null;
  createdByUserId?: number | null;
  metadata?: Record<string, unknown> | null;
  idempotencyKey: string;
};

export type InventoryMovementRecord = InventoryMovementInput & {
  id: string;
  createdAt: Date;
};

export type InventoryMovementStore = {
  findByIdempotencyKey(key: string): Promise<InventoryMovementRecord | null>;
  create(input: InventoryMovementInput): Promise<InventoryMovementRecord>;
};

/**
 * Crea el movimiento si no existe la clave de idempotencia.
 * Retorna { created: false } en reintentos seguros.
 */
export async function recordInventoryMovement(
  store: InventoryMovementStore,
  input: InventoryMovementInput,
): Promise<{ record: InventoryMovementRecord; created: boolean }> {
  const existing = await store.findByIdempotencyKey(input.idempotencyKey);
  if (existing) {
    return { record: existing, created: false };
  }
  const record = await store.create(input);
  return { record, created: true };
}

export function holdIdempotencyKey(
  registrationId: string,
  variantId: string,
  kind: "hold" | "confirm" | "release",
): string {
  return `reg:${registrationId}:var:${variantId}:${kind}`;
}

export function storeHoldIdempotencyKey(
  orderId: string,
  variantId: string,
  kind: "hold" | "sale" | "release",
): string {
  return `store:${orderId}:var:${variantId}:${kind}`;
}
