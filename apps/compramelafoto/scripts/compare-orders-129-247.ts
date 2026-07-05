/**
 * Compara pedido #129 (PrintOrder) y #247 (Order) - mismo cliente, posible doble cobro.
 */

import { prisma } from "../lib/prisma";

async function main() {
  const [printOrder, albumOrder] = await Promise.all([
    prisma.printOrder.findUnique({
      where: { id: 129 },
      include: { items: true },
    }),
    prisma.order.findUnique({
      where: { id: 247 },
      include: {
        items: true,
        album: { select: { id: true, title: true } },
      },
    }),
  ]);

  console.log("\n=== Pedido #129 (PrintOrder - impresión) ===");
  if (printOrder) {
    console.log("customerEmail:", printOrder.customerEmail);
    console.log("customerName:", printOrder.customerName);
    console.log("status:", printOrder.status);
    console.log("paymentStatus:", printOrder.paymentStatus);
    console.log("total:", printOrder.total);
    console.log("orderType:", printOrder.orderType);
    console.log("albumId (tag):", (printOrder.tags || []).find((t) => t.startsWith("ALBUM_ORDER:")));
    console.log("mpPaymentId:", printOrder.mpPaymentId);
    console.log("mpPreferenceId:", printOrder.mpPreferenceId);
    console.log("createdAt:", printOrder.createdAt.toISOString());
    console.log("items:", printOrder.items.length);
  } else {
    console.log("No encontrado");
  }

  console.log("\n=== Pedido #247 (Order - álbum) ===");
  if (albumOrder) {
    console.log("buyerEmail:", albumOrder.buyerEmail);
    console.log("status:", albumOrder.status);
    console.log("totalCents:", albumOrder.totalCents);
    console.log("albumId:", albumOrder.albumId);
    console.log("album:", albumOrder.album?.title);
    console.log("mpPaymentId:", albumOrder.mpPaymentId);
    console.log("mpPreferenceId:", albumOrder.mpPreferenceId);
    console.log("createdAt:", albumOrder.createdAt.toISOString());
    console.log("items:", albumOrder.items.map((i) => `${i.productType} x${i.quantity}`).join(", "));
  } else {
    console.log("No encontrado");
  }

  if (printOrder && albumOrder) {
    const email1 = (printOrder.customerEmail || "").toLowerCase().trim();
    const email2 = (albumOrder.buyerEmail || "").toLowerCase().trim();
    const sameEmail = email1 === email2;
    const samePayment = printOrder.mpPaymentId && albumOrder.mpPaymentId && printOrder.mpPaymentId === albumOrder.mpPaymentId;
    const samePreference = printOrder.mpPreferenceId && albumOrder.mpPreferenceId && printOrder.mpPreferenceId === albumOrder.mpPreferenceId;

    const tagMatch = (printOrder.tags || []).find((t) => t.startsWith("ALBUM_ORDER:"));
    const linkedOrderId = tagMatch ? tagMatch.replace("ALBUM_ORDER:", "") : null;

    console.log("\n--- Análisis ---");
    console.log("Mismo email:", sameEmail, sameEmail ? `(${email1})` : "");
    console.log("Mismo mpPaymentId:", samePayment);
    console.log("Misma mpPreferenceId:", samePreference);
    console.log("PrintOrder #129 vinculado a Order:", linkedOrderId);
    console.log("¿#129 apunta a #247?", linkedOrderId === "247");

    if (samePayment) {
      console.log("\n⚠️  DOBLE REGISTRO: Mismo pago MP en ambos pedidos.");
      console.log("   MP cobró una vez pero hay PrintOrder #129 y Order #247.");
    }

    if (linkedOrderId === "247") {
      console.log("\n   El PrintOrder #129 tiene tag ALBUM_ORDER:247 - está vinculado al Order #247.");
      console.log("   Puede ser: el cliente compró impresiones desde el álbum, se creó Order #247.");
      console.log("   Y además existe PrintOrder #129 con el mismo pago (¿duplicado en otro flujo?).");
    }
  }

  console.log("\n=== Fin ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
