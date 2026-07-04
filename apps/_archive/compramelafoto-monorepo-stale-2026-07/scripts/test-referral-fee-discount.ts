/**
 * Pruebas del descuento de fee con saldo de referidos.
 *
 * Uso:
 *   1) Verificar un pedido existente (qué descuento aplicaría):
 *      npx tsx scripts/test-referral-fee-discount.ts <PrintOrderId>
 *
 *   2) Crear datos de prueba y simular create-preference (descuento):
 *      npx tsx scripts/test-referral-fee-discount.ts --seed
 *
 *   3) Solo simular (sin escribir en DB) para un pedido existente:
 *      npx tsx scripts/test-referral-fee-discount.ts --dry-run <PrintOrderId>
 *
 * Para probar el webhook (consumir earnings al aprobar), ver TEST-REFERRAL-FEE-DISCOUNT.md
 */

import { feeFromTotal } from "../lib/pricing/fee-formula";
import { prisma } from "../lib/prisma";

async function getReferralBalanceCents(photographerId: number): Promise<number> {
  const agg = await prisma.referralEarning.aggregate({
    where: {
      attribution: { referrerUserId: photographerId },
      paidOutAt: null,
      reversedAt: null,
      appliedAt: null,
    },
    _sum: { referralAmountCents: true },
  });
  return agg._sum.referralAmountCents ?? 0;
}

async function runVerify(orderId: number, dryRun: boolean) {
  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      photographerId: true,
      total: true,
      pricingSnapshot: true,
      referralFeeDiscountCents: true,
    },
  });

  if (!order) {
    console.error("No existe PrintOrder con id", orderId);
    process.exit(1);
  }

  console.log("\n=== Pedido #" + orderId + " ===\n");
  console.log("Fotógrafo (vendedor):", order.photographerId ?? "—");
  console.log("Total:", order.total, "| Descuento ya guardado:", order.referralFeeDiscountCents ?? 0, "centavos");

  const snap = (order.pricingSnapshot ?? {}) as Record<string, unknown>;
  let feeCents = Number(snap.marketplaceFeeCents ?? 0) || 0;
  if (feeCents <= 0 && order.total) {
    const pct = Number(snap.marketplaceFeePercent ?? snap.platformFeePercent ?? 0) || 0;
    if (pct > 0) feeCents = feeFromTotal(Number(order.total), pct);
  }
  console.log("Fee de plataforma (snapshot/calculado):", feeCents, "centavos");

  if (order.photographerId == null || feeCents <= 0) {
    console.log("\nNo aplica descuento por referidos (sin photographerId o fee 0).");
    return;
  }

  const balanceCents = await getReferralBalanceCents(order.photographerId);
  console.log("Saldo de referidos del fotógrafo:", balanceCents, "centavos");

  const discountCents = Math.min(feeCents, balanceCents);
  const newFeeCents = Math.max(0, feeCents - discountCents);

  console.log("\n--- Descuento ---");
  console.log("Descuento a aplicar: min(fee, saldo) =", discountCents, "centavos");
  console.log("Fee después del descuento:", newFeeCents, "centavos");

  if (dryRun) {
    console.log("\n[DRY-RUN] No se modificó la base de datos.");
    return;
  }

  if (discountCents > 0) {
    await prisma.printOrder.update({
      where: { id: orderId },
      data: { referralFeeDiscountCents: discountCents },
    });
    console.log("\n✅ Actualizado: referralFeeDiscountCents =", discountCents);
  }
}

async function runSeed() {
  console.log("\n=== Creando datos de prueba para descuento por referidos ===\n");

  const defaultPassword = "referral-test";
  const bcrypt = await import("bcryptjs").then((m) => m.default);
  const hash = await bcrypt.hash(defaultPassword, 10);

  const referrer = await prisma.user.upsert({
    where: { email: "referrer-fee-discount@test.com" },
    update: {},
    create: {
      email: "referrer-fee-discount@test.com",
      password: hash,
      role: "PHOTOGRAPHER",
      name: "Referidor (tiene saldo)",
    },
  });

  const referred = await prisma.user.upsert({
    where: { email: "referred-fee-discount@test.com" },
    update: {},
    create: {
      email: "referred-fee-discount@test.com",
      password: hash,
      role: "PHOTOGRAPHER",
      name: "Referido",
    },
  });

  let code = await prisma.referralCode.findFirst({
    where: { ownerUserId: referrer.id },
  });
  if (!code) {
    code = await prisma.referralCode.create({
      data: {
        code: "REF-DISC-TEST-" + referrer.id,
        ownerUserId: referrer.id,
        isActive: true,
      },
    });
  }

  const endsAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
  let attr = await prisma.referralAttribution.findFirst({
    where: { referredUserId: referred.id },
  });
  if (!attr) {
    attr = await prisma.referralAttribution.create({
      data: {
        referralCodeId: code.id,
        referrerUserId: referrer.id,
        referredUserId: referred.id,
        startsAt: new Date(),
        endsAt,
        status: "ACTIVE",
      },
    });
  }

  const existingEarning = await prisma.referralEarning.findFirst({
    where: {
      attributionId: attr.id,
      paidOutAt: null,
      reversedAt: null,
      appliedAt: null,
    },
  });

  if (!existingEarning) {
    await prisma.referralEarning.create({
      data: {
        attributionId: attr.id,
        paymentId: "test-payment-1",
        saleRef: "PRINT_ORDER:99999",
        platformFeeCents: 1000,
        referralAmountCents: 500,
        platformNetCents: 500,
      },
    });
    console.log("✅ Creado ReferralEarning de 500 centavos para el referidor (referrer id:", referrer.id, ")");
  } else {
    console.log("✅ Ya existe saldo de referidos para el referidor (referrer id:", referrer.id, ")");
  }

  const balanceBefore = await getReferralBalanceCents(referrer.id);
  console.log("Saldo actual del referidor:", balanceBefore, "centavos\n");

  const printOrder = await prisma.printOrder.create({
    data: {
      photographerId: referrer.id,
      total: 15000,
      currency: "ARS",
      pricingSnapshot: {
        marketplaceFeeCents: 800,
        marketplaceFeePercent: 10,
      },
      paymentStatus: "PENDING",
    },
  });

  console.log("✅ Creado PrintOrder #" + printOrder.id + " (fotógrafo = referidor, fee 800 centavos)\n");

  const feeCents = 800;
  const discountCents = Math.min(feeCents, balanceBefore);
  const newFeeCents = Math.max(0, feeCents - discountCents);

  console.log("--- Simulación create-preference ---");
  console.log("Fee original:", feeCents, "| Saldo referidor:", balanceBefore, "| Descuento:", discountCents);
  console.log("Fee a cobrar por MP:", newFeeCents, "centavos\n");

  await prisma.printOrder.update({
    where: { id: printOrder.id },
    data: { referralFeeDiscountCents: discountCents },
  });
  console.log("✅ Guardado referralFeeDiscountCents =", discountCents, "en PrintOrder #" + printOrder.id);

  console.log("\n--- Cómo seguir probando ---");
  console.log("1) Crear preferencia (y pagar en sandbox):");
  console.log("   POST /api/payments/mp/create-preference { \"orderId\": " + printOrder.id + ", \"orderType\": \"PRINT_ORDER\" }");
  console.log("   (O ir al flujo de pago en la app con el usuario referrer-fee-discount@test.com)");
  console.log("2) Cuando el pago quede approved, el webhook marcará earnings con appliedAt.");
  console.log("3) Verificar saldo: GET /api/referrals/me con sesión del referidor → debe excluir los earnings aplicados.");
  console.log("");
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === "--seed") {
    await runSeed();
    return;
  }
  const dryRun = args[0] === "--dry-run";
  const orderIdArg = dryRun ? args[1] : args[0];
  const orderId = Number(orderIdArg);
  if (Number.isFinite(orderId)) {
    await runVerify(orderId, dryRun);
    return;
  }
  console.log("Uso:");
  console.log("  npx tsx scripts/test-referral-fee-discount.ts <PrintOrderId>     # Verificar y aplicar descuento");
  console.log("  npx tsx scripts/test-referral-fee-discount.ts --dry-run <PrintOrderId>  # Solo simular");
  console.log("  npx tsx scripts/test-referral-fee-discount.ts --seed              # Crear datos de prueba");
  process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
