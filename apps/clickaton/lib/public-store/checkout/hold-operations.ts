import "server-only";

import type { Prisma } from "@repo/db";
import { storeHoldIdempotencyKey } from "@/lib/inventory/domain/record-movement";
import { StoreCheckoutError } from "./errors";

type Tx = Prisma.TransactionClient;

/** Incrementa reservedStock de forma condicional (anti-oversell). */
export async function reserveStoreVariantStock(
  tx: Tx,
  input: {
    orderId: string;
    productId: string;
    productVariantId: string;
    quantity: number;
    expiresAt: Date;
  },
): Promise<void> {
  const rows = await tx.$executeRaw`
    UPDATE "ClickatonProductVariant"
    SET
      "reservedStock" = "reservedStock" + ${input.quantity},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "id" = ${input.productVariantId}
      AND "isActive" = true
      AND ("stock" - "reservedStock") >= ${input.quantity}
  `;
  if (Number(rows) !== 1) {
    throw new StoreCheckoutError(
      "STOCK_INSUFFICIENT",
      "Sin stock suficiente para reservar.",
      409,
    );
  }

  await tx.clickatonStoreStockHold.create({
    data: {
      orderId: input.orderId,
      productId: input.productId,
      productVariantId: input.productVariantId,
      quantity: input.quantity,
      status: "ACTIVE",
      expiresAt: input.expiresAt,
    },
  });

  const key = storeHoldIdempotencyKey(input.orderId, input.productVariantId, "hold");
  const existing = await tx.clickatonInventoryMovement.findUnique({
    where: { idempotencyKey: key },
  });
  if (!existing) {
    await tx.clickatonInventoryMovement.create({
      data: {
        productId: input.productId,
        variantId: input.productVariantId,
        movementType: "STORE_HOLD",
        quantity: input.quantity,
        sourceType: "STORE_ORDER",
        sourceId: input.orderId,
        reason: "Hold de stock por pedido TIENDA",
        idempotencyKey: key,
      },
    });
  }
}

/**
 * Captura hold ACTIVE → CAPTURED: baja stock físico y reservedStock.
 * Idempotente por ledger STORE_SALE.
 */
export async function captureStoreHoldsForOrder(
  tx: Tx,
  orderId: string,
): Promise<{ captured: number; skipped: number }> {
  const holds = await tx.clickatonStoreStockHold.findMany({
    where: { orderId, status: "ACTIVE" },
  });
  let captured = 0;
  let skipped = 0;
  const now = new Date();

  for (const hold of holds) {
    const saleKey = storeHoldIdempotencyKey(orderId, hold.productVariantId, "sale");
    const existingSale = await tx.clickatonInventoryMovement.findUnique({
      where: { idempotencyKey: saleKey },
    });
    if (existingSale) {
      if (hold.status === "ACTIVE") {
        await tx.clickatonStoreStockHold.update({
          where: { id: hold.id },
          data: { status: "CAPTURED", consumedAt: now },
        });
      }
      skipped += 1;
      continue;
    }

    const rows = await tx.$executeRaw`
      UPDATE "ClickatonProductVariant"
      SET
        "stock" = "stock" - ${hold.quantity},
        "reservedStock" = GREATEST(0, "reservedStock" - ${hold.quantity}),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${hold.productVariantId}
        AND "stock" >= ${hold.quantity}
        AND "reservedStock" >= ${hold.quantity}
    `;
    if (Number(rows) !== 1) {
      throw new StoreCheckoutError(
        "STOCK_INSUFFICIENT",
        "No se pudo capturar stock reservado.",
        409,
      );
    }

    await tx.clickatonStoreStockHold.update({
      where: { id: hold.id },
      data: { status: "CAPTURED", consumedAt: now },
    });

    await tx.clickatonInventoryMovement.create({
      data: {
        productId: hold.productId,
        variantId: hold.productVariantId,
        movementType: "STORE_SALE",
        quantity: hold.quantity,
        sourceType: "STORE_ORDER",
        sourceId: orderId,
        reason: "Venta TIENDA confirmada (pago aprobado)",
        idempotencyKey: saleKey,
      },
    });
    captured += 1;
  }

  return { captured, skipped };
}

/** Libera holds ACTIVE → RELEASED|EXPIRED y baja reservedStock. */
export async function releaseStoreHoldsForOrder(
  tx: Tx,
  input: {
    orderId: string;
    reason: "EXPIRED" | "RELEASED";
  },
): Promise<number> {
  const holds = await tx.clickatonStoreStockHold.findMany({
    where: { orderId: input.orderId, status: "ACTIVE" },
  });
  const now = new Date();
  let released = 0;

  for (const hold of holds) {
    const releaseKey = storeHoldIdempotencyKey(
      input.orderId,
      hold.productVariantId,
      "release",
    );
    const existing = await tx.clickatonInventoryMovement.findUnique({
      where: { idempotencyKey: releaseKey },
    });
    if (existing) {
      if (hold.status === "ACTIVE") {
        await tx.clickatonStoreStockHold.update({
          where: { id: hold.id },
          data: {
            status: input.reason === "EXPIRED" ? "EXPIRED" : "RELEASED",
            releasedAt: now,
          },
        });
      }
      continue;
    }

    await tx.$executeRaw`
      UPDATE "ClickatonProductVariant"
      SET
        "reservedStock" = GREATEST(0, "reservedStock" - ${hold.quantity}),
        "updatedAt" = CURRENT_TIMESTAMP
      WHERE "id" = ${hold.productVariantId}
    `;

    await tx.clickatonStoreStockHold.update({
      where: { id: hold.id },
      data: {
        status: input.reason === "EXPIRED" ? "EXPIRED" : "RELEASED",
        releasedAt: now,
      },
    });

    await tx.clickatonInventoryMovement.create({
      data: {
        productId: hold.productId,
        variantId: hold.productVariantId,
        movementType: "STORE_RELEASED",
        quantity: hold.quantity,
        sourceType: "STORE_ORDER",
        sourceId: input.orderId,
        reason:
          input.reason === "EXPIRED"
            ? "Hold TIENDA vencido"
            : "Hold TIENDA liberado (pago rechazado/cancelado)",
        idempotencyKey: releaseKey,
      },
    });
    released += 1;
  }

  return released;
}
