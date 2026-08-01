import "server-only";

import { Prisma, prisma } from "@repo/db";
import { releaseStoreHoldsForOrder } from "./hold-operations";
import { logStoreCheckoutEvent } from "./observability";
import { assertStoreOrderTransition } from "./transitions";

export async function expireStoreHoldsBatch(input?: {
  dryRun?: boolean;
  limit?: number;
  now?: Date;
}): Promise<{
  scanned: number;
  expired: number;
  skipped: number;
  dryRun: boolean;
}> {
  const now = input?.now ?? new Date();
  const limit = Math.min(Math.max(input?.limit ?? 100, 1), 500);
  const dryRun = Boolean(input?.dryRun);

  const candidates = await prisma.clickatonStoreOrder.findMany({
    where: {
      status: { in: ["PENDING_PAYMENT", "PAYMENT_FAILED"] },
      holdExpiresAt: { lte: now },
      stockHolds: { some: { status: "ACTIVE" } },
    },
    select: { id: true, publicId: true, status: true },
    take: limit,
    orderBy: { holdExpiresAt: "asc" },
  });

  let expired = 0;
  let skipped = 0;

  for (const row of candidates) {
    if (dryRun) {
      expired += 1;
      continue;
    }
    try {
      await prisma.$transaction(
        async (tx) => {
          const current = await tx.clickatonStoreOrder.findUniqueOrThrow({
            where: { id: row.id },
          });
          if (current.status === "PAID") {
            skipped += 1;
            return;
          }
          await releaseStoreHoldsForOrder(tx, {
            orderId: current.id,
            reason: "EXPIRED",
          });
          if (current.status !== "EXPIRED") {
            assertStoreOrderTransition(current.status, "EXPIRED");
            await tx.clickatonStoreOrder.update({
              where: { id: current.id },
              data: { status: "EXPIRED", paymentStatus: "CANCELLED" },
            });
          }
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      expired += 1;
      logStoreCheckoutEvent("store_order_expired", {
        orderId: row.id,
        publicId: row.publicId,
      });
      logStoreCheckoutEvent("store_hold_released", {
        orderId: row.id,
        publicId: row.publicId,
        reason: "EXPIRED",
      });
    } catch {
      skipped += 1;
    }
  }

  return { scanned: candidates.length, expired, skipped, dryRun };
}
