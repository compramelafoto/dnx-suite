/**
 * Verifica que el flujo de referidos esté correcto para un pedido (para usar después de una prueba real).
 * Uso: npx tsx scripts/verify-referral-flow.ts 91
 *
 * Comprueba:
 * 1) El pedido tiene pricingSnapshot con marketplaceFeeCents > 0
 * 2) El fotógrafo tiene una atribución ACTIVA (referrer, endsAt en el futuro)
 * 3) El referrer tiene Mercado Pago conectado
 * 4) Existe ReferralEarning para este pedido (se creó en el webhook)
 */

import { prisma } from "../lib/prisma";

async function main() {
  const orderId = Number(process.argv[2]);
  if (!Number.isFinite(orderId)) {
    console.log("Uso: npx tsx scripts/verify-referral-flow.ts <PrintOrderId>");
    process.exit(1);
  }

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      photographerId: true,
      paymentStatus: true,
      total: true,
      pricingSnapshot: true,
      createdAt: true,
    },
  });

  if (!order) {
    console.log("\n❌ No existe PrintOrder con id", orderId);
    process.exit(1);
  }

  console.log("\n=== Verificación flujo referidos – Pedido #" + orderId + " ===\n");
  console.log("Estado pago:", order.paymentStatus, "| Total:", order.total, "centavos");

  const snap = (order.pricingSnapshot ?? {}) as Record<string, unknown>;
  const feeInSnapshot = Number(snap.marketplaceFeeCents ?? 0);
  const pctInSnapshot = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0);

  let ok = true;

  // 1) Snapshot con fee
  if (order.photographerId == null) {
    console.log("\n⏭️  Sin photographerId (ej. flujo público) – no aplica referido.");
    process.exit(0);
  }

  if (feeInSnapshot <= 0 && !pctInSnapshot) {
    console.log("\n❌ El pedido no tiene marketplaceFeeCents ni percent en el snapshot. El motor de precios debe incluir marketplaceFeeCents en el snapshot.");
    ok = false;
  } else if (feeInSnapshot > 0) {
    console.log("✅ Snapshot con marketplaceFeeCents:", feeInSnapshot, "centavos");
  } else {
    console.log("⚠️  Snapshot sin marketplaceFeeCents pero tiene % – el webhook usará fallback. OK.");
  }

  // 2) Atribución activa
  const attribution = await prisma.referralAttribution.findFirst({
    where: {
      referredUserId: order.photographerId,
      status: "ACTIVE",
      endsAt: { gt: new Date() },
    },
    include: {
      referrerUser: {
        select: { id: true, name: true, email: true, mpUserId: true, mpConnectedAt: true },
      },
    },
  });

  if (!attribution) {
    console.log("❌ El fotógrafo no tiene ninguna atribución ACTIVA (referido) con endsAt en el futuro.");
    ok = false;
  } else {
    console.log("✅ Atribución activa – referrer:", attribution.referrerUser?.name, "(userId", attribution.referrerUserId + ")");
    const referrerHasMp = !!(attribution.referrerUser?.mpUserId || attribution.referrerUser?.mpConnectedAt);
    if (!referrerHasMp) {
      console.log("❌ El referrer NO tiene Mercado Pago conectado – no se crea ReferralEarning.");
      ok = false;
    } else {
      console.log("✅ Referrer tiene MP conectado.");
    }
  }

  // 3) ReferralEarning creado
  const earning = await prisma.referralEarning.findFirst({
    where: { saleRef: `PRINT_ORDER:${orderId}` },
  });

  if (!earning) {
    console.log("❌ No existe ReferralEarning para PRINT_ORDER:" + orderId + ". El webhook no lo creó (revisar que el pago esté approved y que el servidor tenga el código actual).");
    ok = false;
  } else {
    console.log("✅ ReferralEarning creado – referrer:", earning.referralAmountCents, "centavos | plataforma:", earning.platformNetCents, "centavos");
  }

  console.log("");
  if (ok) {
    console.log("✅ Flujo de referidos OK para este pedido.");
  } else {
    console.log("❌ Hay fallos. Revisar los puntos anteriores.");
  }
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
