/**
 * Sincroniza pedidos reembolsados: consulta Mercado Pago y actualiza Order/PrintOrder
 * a REFUNDED cuando el pago en MP está refunded o charged_back.
 *
 * Uso: npx tsx scripts/sync-refunded-orders.ts [--verbose]
 *
 * Requiere: .env con DATABASE_URL y MP_ACCESS_TOKEN (o tokens OAuth de fotógrafos).
 */

import "dotenv/config";
import { getPaymentById, searchPaymentsByExternalReference } from "../lib/mercadopago";
import { revokeOrderDownloadTokens } from "../lib/download-tokens";
import { prisma } from "../lib/prisma";

async function getPaymentForAlbumOrder(
  orderId: number,
  albumUserId: number | null,
  mpPaymentId: string | null,
  verbose: boolean
) {
  let tokenOverride: string | undefined;
  if (albumUserId) {
    const user = await prisma.user.findUnique({
      where: { id: albumUserId },
      select: { mpAccessToken: true },
    });
    if (user?.mpAccessToken) tokenOverride = user.mpAccessToken;
  }

  if (mpPaymentId?.trim()) {
    try {
      const pay = await getPaymentById(mpPaymentId.trim(), { accessTokenOverride: tokenOverride });
      if (pay.external_reference === String(orderId)) return pay;
    } catch {
      try {
        const pay = await getPaymentById(mpPaymentId.trim(), {});
        if (pay.external_reference === String(orderId)) return pay;
      } catch {}
    }
  }

  for (const token of [tokenOverride, undefined]) {
    try {
      const list = await searchPaymentsByExternalReference(String(orderId), {
        accessTokenOverride: token ?? undefined,
        dateRangeDays: 365,
      });
      if (list.length > 0) {
        const approved = list.find((p) => p.status === "approved");
        const refunded = list.find((p) => p.status === "refunded" || p.status === "charged_back");
        return refunded ?? approved ?? list[0];
      }
    } catch {}
  }
  return null;
}

async function main() {
  const verbose = process.argv.includes("--verbose");
  console.log("\n--- Sincronizar pedidos reembolsados con Mercado Pago ---\n");

  let updated = 0;

  // 1) Order (ALBUM_ORDER) con status PAID
  const paidOrders = await prisma.order.findMany({
    where: { status: "PAID" },
    select: {
      id: true,
      mpPaymentId: true,
      album: { select: { userId: true } },
    },
  });

  for (const order of paidOrders) {
    try {
      const pay = await getPaymentForAlbumOrder(
        order.id,
        order.album?.userId ?? null,
        order.mpPaymentId,
        verbose
      );
      if (!pay) continue;
      if (pay.status !== "refunded" && pay.status !== "charged_back") continue;

      await prisma.order.update({
        where: { id: order.id },
        data: { status: "REFUNDED" },
      });
      try {
        await revokeOrderDownloadTokens(order.id);
      } catch {}
      const tag = `ALBUM_ORDER:${order.id}`;
      await prisma.printOrder.updateMany({
        where: { tags: { has: tag } },
        data: { paymentStatus: "REFUNDED", mpPaymentId: String(pay.id), statusUpdatedAt: new Date() },
      });
      console.log(`✅ Order #${order.id}: actualizado a REFUNDED (${pay.status})`);
      updated++;
    } catch (e) {
      if (verbose) console.error(`❌ Order #${order.id}:`, (e as Error).message);
    }
  }

  // 2) PrintOrder con paymentStatus PAID
  const paidPrintOrders = await prisma.printOrder.findMany({
    where: { paymentStatus: "PAID" },
    select: { id: true, photographerId: true, labId: true, mpPaymentId: true },
  });

  for (const order of paidPrintOrders) {
    try {
      let tokenOverride: string | undefined;
      if (order.photographerId) {
        const u = await prisma.user.findUnique({
          where: { id: order.photographerId },
          select: { mpAccessToken: true },
        });
        if (u?.mpAccessToken) tokenOverride = u.mpAccessToken;
      }
      if (!tokenOverride && order.labId) {
        const lab = await prisma.lab.findUnique({
          where: { id: order.labId },
          select: { mpAccessToken: true },
        });
        if (lab?.mpAccessToken) tokenOverride = lab.mpAccessToken;
      }

      let pay = null;
      if (order.mpPaymentId?.trim()) {
        try {
          pay = await getPaymentById(order.mpPaymentId.trim(), { accessTokenOverride: tokenOverride });
          if (pay.external_reference !== String(order.id)) pay = null;
        } catch {}
      }
      if (!pay) {
        for (const token of [tokenOverride, undefined]) {
          try {
            const list = await searchPaymentsByExternalReference(String(order.id), {
              accessTokenOverride: token ?? undefined,
              dateRangeDays: 365,
            });
            if (list.length > 0) pay = list[0];
          } catch {}
          if (pay) break;
        }
      }
      if (!pay || (pay.status !== "refunded" && pay.status !== "charged_back")) continue;

      await prisma.printOrder.update({
        where: { id: order.id },
        data: {
          paymentStatus: "REFUNDED",
          mpPaymentId: String(pay.id),
          statusUpdatedAt: new Date(),
        },
      });
      console.log(`✅ PrintOrder #${order.id}: actualizado a REFUNDED (${pay.status})`);
      updated++;
    } catch (e) {
      if (verbose) console.error(`❌ PrintOrder #${order.id}:`, (e as Error).message);
    }
  }

  console.log(`\n--- Total actualizados: ${updated} ---\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
