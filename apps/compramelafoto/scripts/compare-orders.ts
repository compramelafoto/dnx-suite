/**
 * Compara dos pedidos (mismo cliente, posible doble cobro).
 * Uso: npx tsx scripts/compare-orders.ts 129 247
 */

import { prisma } from "../lib/prisma";

const ID1 = parseInt(process.argv[2] || "129", 10);
const ID2 = parseInt(process.argv[3] || "247", 10);

async function main() {
  console.log(`\n=== Comparación pedidos #${ID1} y #${ID2} ===\n`);

  const [o1, o2] = await Promise.all([
    prisma.order.findUnique({
      where: { id: ID1 },
      include: {
        items: { select: { id: true, photoId: true, productType: true, quantity: true, subtotalCents: true } },
        album: { select: { id: true, title: true, publicSlug: true } },
      },
    }),
    prisma.order.findUnique({
      where: { id: ID2 },
      include: {
        items: { select: { id: true, photoId: true, productType: true, quantity: true, subtotalCents: true } },
        album: { select: { id: true, title: true, publicSlug: true } },
      },
    }),
  ]);

  if (!o1) {
    console.log(`Pedido #${ID1} no encontrado (Order).`);
    const po1 = await prisma.printOrder.findUnique({ where: { id: ID1 } });
    if (po1) console.log(`  Existe PrintOrder #${ID1} - es pedido de impresión, no de álbum.`);
    return;
  }
  if (!o2) {
    console.log(`Pedido #${ID2} no encontrado (Order).`);
    return;
  }

  console.log("Pedido #" + o1.id);
  console.log("  buyerEmail:", o1.buyerEmail);
  console.log("  buyerUserId:", o1.buyerUserId);
  console.log("  status:", o1.status);
  console.log("  totalCents:", o1.totalCents);
  console.log("  albumId:", o1.albumId, "| álbum:", o1.album?.title);
  console.log("  mpPaymentId:", o1.mpPaymentId);
  console.log("  mpPreferenceId:", o1.mpPreferenceId);
  console.log("  createdAt:", o1.createdAt.toISOString());
  console.log("  items:", o1.items.map((i) => `${i.productType} x${i.quantity} photoId=${i.photoId}`).join(", "));

  console.log("\nPedido #" + o2.id);
  console.log("  buyerEmail:", o2.buyerEmail);
  console.log("  buyerUserId:", o2.buyerUserId);
  console.log("  status:", o2.status);
  console.log("  totalCents:", o2.totalCents);
  console.log("  albumId:", o2.albumId, "| álbum:", o2.album?.title);
  console.log("  mpPaymentId:", o2.mpPaymentId);
  console.log("  mpPreferenceId:", o2.mpPreferenceId);
  console.log("  createdAt:", o2.createdAt.toISOString());
  console.log("  items:", o2.items.map((i) => `${i.productType} x${i.quantity} photoId=${i.photoId}`).join(", "));

  const sameEmail = (o1.buyerEmail || "").toLowerCase().trim() === (o2.buyerEmail || "").toLowerCase().trim();
  const sameAlbum = o1.albumId === o2.albumId;
  const samePreference = o1.mpPreferenceId && o2.mpPreferenceId && o1.mpPreferenceId === o2.mpPreferenceId;
  const samePayment = o1.mpPaymentId && o2.mpPaymentId && o1.mpPaymentId === o2.mpPaymentId;

  console.log("\n--- Análisis ---");
  console.log("Mismo email:", sameEmail);
  console.log("Mismo álbum:", sameAlbum, sameAlbum ? `(ID ${o1.albumId})` : "");
  console.log("Misma preferencia MP:", samePreference);
  console.log("Mismo pago MP:", samePayment);

  if (samePayment && o1.status === "PAID" && o2.status === "PAID") {
    console.log("\n⚠️  Los dos pedidos tienen el mismo mpPaymentId y están PAID.");
    console.log("   Posible doble cobro: MP cobró una vez pero el sistema registró dos Orders.");
  }

  if (samePreference && !samePayment) {
    console.log("\n   Misma preferencia MP pero distintos pagos: puede ser que el cliente pagó dos veces (dos intentos).");
  }

  if (sameAlbum && sameEmail) {
    console.log("\n   Mismo cliente, mismo álbum. Revisar si compró dos veces o si se duplicó el registro.");
  }

  // Webhook events para ver si hay duplicados
  const webhooks = await prisma.webhookEvent.findMany({
    where: {
      OR: [
        { orderId: o1.id, orderType: "ALBUM_ORDER" },
        { orderId: o2.id, orderType: "ALBUM_ORDER" },
      ],
    },
    orderBy: { processedAt: "asc" },
    take: 20,
  });
  console.log("\nWebhookEvent (orden/album):", webhooks.length);
  webhooks.forEach((w) => {
    console.log(`  orderId=${w.orderId} paymentId=${w.paymentId} status=${w.status} processed=${w.processedAt.toISOString()}`);
  });

  console.log("\n=== Fin ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
