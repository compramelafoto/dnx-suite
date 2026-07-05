/**
 * Auditoría y reenvío opcional de mails al fotógrafo para pedidos de álbum recientes (mixtos / impresión).
 *
 * No crea ni duplica Order ni PrintOrder. Solo lectura + opcionalmente reencola emails.
 *
 * Uso:
 *   npx tsx scripts/backfill-mixed-orders-last-24h.ts              # dry-run (default)
 *   npx tsx scripts/backfill-mixed-orders-last-24h.ts --apply      # igual dry-run (sin --requeue-emails no envía nada)
 *   npx tsx scripts/backfill-mixed-orders-last-24h.ts --apply --requeue-emails
 *
 * Requiere: .env con DATABASE_URL (y para requeue: cola de email como en producción).
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { getAlbumOrderFulfillmentFromItems } from "../lib/order-fulfillment";
import {
  queuePhotographerOrderNotification,
  queuePhotographerPrintOrderNotification,
} from "../lib/order-confirmation-email";

const HOURS = 24;

function parseArgs() {
  const argv = process.argv.slice(2);
  return {
    apply: argv.includes("--apply"),
    requeueEmails: argv.includes("--requeue-emails"),
  };
}

async function main() {
  const { apply, requeueEmails } = parseArgs();

  if (!apply) {
    console.log("Modo dry-run (solo reporte). Pasá --apply --requeue-emails para reencolar mails.\n");
  } else if (!requeueEmails) {
    console.log("--apply sin --requeue-emails: no se envían mails (idempotente, sin efectos).\n");
  }

  const since = new Date(Date.now() - HOURS * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      OR: [{ createdAt: { gte: since } }, { updatedAt: { gte: since } }],
    },
    include: {
      items: { select: { productType: true } },
    },
    orderBy: { id: "desc" },
    take: 500,
  });

  const orderIds = orders.map((o) => o.id);
  const tagClauses = orderIds.map((id) => ({ tags: { has: `ALBUM_ORDER:${id}` as string } }));
  const mirrorsForOrders =
    orderIds.length === 0
      ? []
      : await prisma.printOrder.findMany({
          where: { OR: tagClauses },
          select: { id: true, paymentStatus: true, tags: true },
        });

  function albumIdFromMirrorTags(tags: string[]): number | null {
    for (const t of tags) {
      const m = String(t).match(/^ALBUM_ORDER:(\d+)$/);
      if (m && Number.isFinite(Number(m[1]))) return Number(m[1]);
    }
    return null;
  }

  const mirrorByAlbumId = new Map<number, { id: number; paymentStatus: string }>();
  for (const po of mirrorsForOrders) {
    const aid = albumIdFromMirrorTags((po.tags || []) as string[]);
    if (aid != null) mirrorByAlbumId.set(aid, { id: po.id, paymentStatus: po.paymentStatus });
  }

  console.log(`Pedidos de álbum tocados en las últimas ${HOURS}h (máx 500): ${orders.length}\n`);
  console.log(
    "orderId | fulfillment | D | P | PAID | mirror | export-print OK | requeue?"
  );
  console.log("-".repeat(90));

  for (const o of orders) {
    const f = getAlbumOrderFulfillmentFromItems(o.items);
    const mirror = mirrorByAlbumId.get(o.id);

    const paid = o.status === "PAID";
    const hasMirror = Boolean(mirror?.id);
    const exportPrintOk = paid && f.hasPrintItems && f.printItemsCount > 0;
    const suggestRequeueMixed = paid && f.kind === "MIXED";
    const suggestRequeuePrintOnly =
      paid && f.kind === "PRINT" && hasMirror && mirror?.paymentStatus === "PAID";
    const suggestRequeue = suggestRequeueMixed || suggestRequeuePrintOnly;

    console.log(
      [
        o.id,
        f.kind,
        f.digitalItemsCount,
        f.printItemsCount,
        paid ? "yes" : "no",
        hasMirror ? `po:${mirror!.id}` : "—",
        exportPrintOk ? "yes" : "no",
        suggestRequeue ? (suggestRequeueMixed ? "mixed" : "print") : "no",
      ].join(" | ")
    );

    if (apply && requeueEmails && suggestRequeueMixed) {
      await queuePhotographerOrderNotification(o.id);
      console.log(`  → encolado photographer_order (mixto) para Order #${o.id}`);
    } else if (apply && requeueEmails && suggestRequeuePrintOnly && mirror) {
      await queuePhotographerPrintOrderNotification(mirror.id);
      console.log(`  → encolado photographer_print_order para PrintOrder #${mirror.id} (pedido álbum #${o.id})`);
    }
  }

  console.log("\nListo.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
