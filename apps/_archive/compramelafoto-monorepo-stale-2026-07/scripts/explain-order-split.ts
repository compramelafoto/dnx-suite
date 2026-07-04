/**
 * Consulta un pedido por ID y muestra el desglose de dinero según la lógica del código.
 * Uso: npx tsx scripts/explain-order-split.ts 88
 *
 * Soporta:
 * - PrintOrder (pedido de impresión): id 88 → pedido #88 de /api/print-orders
 * - Order (pedido de álbum): id 88 → compra de fotos de un álbum
 */

import { prisma } from "../lib/prisma";

const REFERRAL_SPLIT_PERCENT = 50; // 50% del fee al referrer

function formatCents(cents: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

async function explainPrintOrder(id: number) {
  const order = await prisma.printOrder.findUnique({
    where: { id },
    include: {
      photographer: { select: { id: true, name: true, email: true } },
      lab: { select: { id: true, name: true } },
      client: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) return null;

  const totalCents = Number(order.total) ?? 0;
  const snapshot = (order.pricingSnapshot ?? {}) as Record<string, unknown>;
  const marketplaceFeeCents = Number(snapshot.marketplaceFeeCents ?? 0) ?? 0;

  // Comisión de plataforma (se calcula en webhook con calculateOrderCommissions)
  const platformCommission = Number(order.platformCommission ?? 0) ?? 0;
  const platformFeeCents = marketplaceFeeCents > 0 ? marketplaceFeeCents : platformCommission;

  // Referido: si el fotógrafo fue referido y hay atribución activa, 50% del fee va al referrer
  let referralAmountCents = 0;
  let platformNetCents = platformFeeCents;
  if (order.photographerId && platformFeeCents > 0) {
    const earning = await prisma.referralEarning.findFirst({
      where: { saleRef: `PRINT_ORDER:${id}` },
      include: {
        attribution: {
          include: {
            referrerUser: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    if (earning) {
      referralAmountCents = earning.referralAmountCents;
      platformNetCents = earning.platformNetCents;
    }
  }

  // Quién recibe el resto: fotógrafo o lab (el "collector" en MP recibe total - fee que retiene MP/plataforma)
  const recipientGetsCents = totalCents - platformFeeCents;

  console.log("\n========== PEDIDO DE IMPRESIÓN #" + id + " ==========\n");
  console.log("Estado:", order.paymentStatus, "| Tipo:", order.orderType);
  console.log("Total cobrado al cliente:", formatCents(totalCents), `(${totalCents} centavos)`);
  console.log("");
  console.log("--- Desglose ---");
  console.log("1) Receptor del pago (fotógrafo o lab):", formatCents(recipientGetsCents));
  if (order.photographer) {
    console.log("   → Fotógrafo:", order.photographer.name, `(userId ${order.photographer.id})`);
  }
  if (order.lab) {
    console.log("   → Laboratorio:", order.lab.name, `(labId ${order.lab.id})`);
  }
  console.log("");
  console.log("2) Fee de plataforma (marketplace):", formatCents(platformFeeCents));
  if (referralAmountCents > 0) {
    console.log("   - Referrer (50% del fee):", formatCents(referralAmountCents));
    console.log("   - Plataforma (neto):", formatCents(platformNetCents));
    const att = await prisma.referralEarning.findFirst({
      where: { saleRef: `PRINT_ORDER:${id}` },
      include: { attribution: { include: { referrerUser: { select: { name: true, email: true } } } } },
    });
    if (att?.attribution?.referrerUser) {
      console.log("   → Referrer:", att.attribution.referrerUser.name, att.attribution.referrerUser.email);
    }
  } else {
    console.log("   → Todo va a la plataforma (sin referido aplicado).");
  }
  console.log("");
  console.log("--- Resumen ---");
  console.log("  Cliente paga:     ", formatCents(totalCents));
  console.log("  Fotógrafo/Lab:   ", formatCents(recipientGetsCents));
  console.log("  Plataforma:       ", formatCents(platformNetCents));
  if (referralAmountCents > 0) {
    console.log("  Referrer:         ", formatCents(referralAmountCents));
  }
  console.log("  Suma destinos:    ", formatCents(recipientGetsCents + platformNetCents + referralAmountCents));
  console.log("");

  return order;
}

async function explainAlbumOrder(id: number) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      album: { select: { userId: true, title: true }, include: { user: { select: { id: true, name: true, email: true } } } },
      items: true,
    },
  });

  if (!order) return null;

  const totalCents = Number(order.totalCents) ?? 0;
  const platformCommissionCents = Number(order.platformCommissionCents ?? 0) ?? 0;
  const platformFeeCents = platformCommissionCents;

  let referralAmountCents = 0;
  let platformNetCents = platformFeeCents;
  const photographerId = order.album?.userId ?? null;
  if (photographerId && platformFeeCents > 0) {
    const earning = await prisma.referralEarning.findFirst({
      where: { saleRef: `ALBUM_ORDER:${id}` },
      include: {
        attribution: {
          include: { referrerUser: { select: { name: true, email: true } } },
        },
      },
    });
    if (earning) {
      referralAmountCents = earning.referralAmountCents;
      platformNetCents = earning.platformNetCents;
    }
  }

  const photographerGetsCents = totalCents - platformFeeCents;

  console.log("\n========== PEDIDO DE ÁLBUM (Order) #" + id + " ==========\n");
  console.log("Estado:", order.status);
  console.log("Álbum:", order.album?.title ?? "—");
  console.log("Total cobrado al cliente:", formatCents(totalCents), `(${totalCents} centavos)`);
  console.log("");
  console.log("--- Desglose ---");
  console.log("1) Fotógrafo (dueño del álbum):", formatCents(photographerGetsCents));
  if (order.album?.user) {
    console.log("   →", order.album.user.name, `(userId ${order.album.user.id})`);
  }
  console.log("");
  console.log("2) Fee de plataforma:", formatCents(platformFeeCents));
  if (referralAmountCents > 0) {
    console.log("   - Referrer (50% del fee):", formatCents(referralAmountCents));
    console.log("   - Plataforma (neto):", formatCents(platformNetCents));
    const att = await prisma.referralEarning.findFirst({
      where: { saleRef: `ALBUM_ORDER:${id}` },
      include: { attribution: { include: { referrerUser: { select: { name: true, email: true } } } } },
    });
    if (att?.attribution?.referrerUser) {
      console.log("   → Referrer:", att.attribution.referrerUser.name, att.attribution.referrerUser.email);
    }
  } else {
    console.log("   → Todo a la plataforma (sin referido).");
  }
  console.log("");
  console.log("--- Resumen ---");
  console.log("  Cliente paga:     ", formatCents(totalCents));
  console.log("  Fotógrafo:        ", formatCents(photographerGetsCents));
  console.log("  Plataforma:       ", formatCents(platformNetCents));
  if (referralAmountCents > 0) {
    console.log("  Referrer:         ", formatCents(referralAmountCents));
  }
  console.log("  Suma destinos:    ", formatCents(photographerGetsCents + platformNetCents + referralAmountCents));
  console.log("");

  return order;
}

async function main() {
  const id = Number(process.argv[2]);
  if (!Number.isFinite(id)) {
    console.log("Uso: npx tsx scripts/explain-order-split.ts <id>");
    console.log("Ejemplo: npx tsx scripts/explain-order-split.ts 88");
    process.exit(1);
  }

  const printOrder = await explainPrintOrder(id);
  if (printOrder) {
    process.exit(0);
  }

  const albumOrder = await explainAlbumOrder(id);
  if (albumOrder) {
    process.exit(0);
  }

  console.log("No se encontró PrintOrder ni Order con id", id);
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
