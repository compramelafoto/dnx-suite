/**
 * Corrige duplicados de ReferralEarning (mismo saleRef) y recalcula el monto
 * de las solicitudes de cobro PENDIENTES.
 *
 * Uso: npx tsx scripts/fix-referral-duplicates.ts
 *
 * 1. Marca como revertidos (reversedAt) los ReferralEarning duplicados por saleRef (deja uno por venta).
 * 2. Recalcula amountCents de cada ReferralPayoutRequest PENDING con la suma actual del saldo del referidor.
 */

import { prisma } from "../lib/prisma";

async function main() {
  console.log("\n--- Fix referidos: duplicados y montos pendientes ---\n");

  // Comprobar que las tablas existen
  try {
    await prisma.referralEarning.count();
  } catch (e: any) {
    if (e?.code === "P2021" || e?.message?.includes("does not exist")) {
      console.log("  La tabla ReferralEarning no existe en esta base de datos.");
      console.log("  Ejecutá este script contra la base donde estén los datos de referidos (ej. producción).\n");
      return;
    }
    throw e;
  }

  // 1. Encontrar ReferralEarning con saleRef no nulo y agrupar por saleRef
  const allWithSaleRef = await prisma.referralEarning.findMany({
    where: { saleRef: { not: null } },
    select: { id: true, saleRef: true },
    orderBy: [{ saleRef: "asc" }, { id: "asc" }],
  });

  const bySaleRef = new Map<string, { id: number }[]>();
  for (const row of allWithSaleRef) {
    const ref = row.saleRef!;
    if (!bySaleRef.has(ref)) bySaleRef.set(ref, []);
    bySaleRef.get(ref)!.push({ id: row.id });
  }

  let reversedCount = 0;
  for (const [saleRef, rows] of bySaleRef) {
    if (rows.length <= 1) continue;
    // Dejar el primero (id menor), revertir el resto
    const toReverse = rows.slice(1).map((r) => r.id);
    const result = await prisma.referralEarning.updateMany({
      where: { id: { in: toReverse } },
      data: { reversedAt: new Date() },
    });
    reversedCount += result.count;
    console.log(`  saleRef "${saleRef}": ${rows.length} registros → revertidos ${result.count} duplicados`);
  }

  if (reversedCount > 0) {
    console.log(`\n  Total ReferralEarning marcados como revertidos: ${reversedCount}\n`);
  } else {
    console.log("  No se encontraron duplicados por saleRef.\n");
  }

  // 2. Recalcular amountCents de cada ReferralPayoutRequest PENDING
  const pending = await prisma.referralPayoutRequest.findMany({
    where: { status: "PENDING" },
    include: {
      referrerUser: { select: { id: true, name: true, email: true } },
    },
  });

  if (pending.length === 0) {
    console.log("  No hay solicitudes de cobro PENDIENTES.\n");
    return;
  }

  for (const req of pending) {
    const agg = await prisma.referralEarning.aggregate({
      where: {
        attribution: { referrerUserId: req.referrerUserId },
        paidOutAt: null,
        reversedAt: null,
        appliedAt: null,
      },
      _sum: { referralAmountCents: true },
    });
    const correctCents = agg._sum.referralAmountCents ?? 0;
    const prev = req.amountCents;
    if (prev !== correctCents) {
      await prisma.referralPayoutRequest.update({
        where: { id: req.id },
        data: { amountCents: correctCents },
      });
      const name = req.referrerUser?.name || req.referrerUser?.email || `#${req.referrerUserId}`;
      console.log(`  Solicitud #${req.id} (${name}): $${prev} → $${correctCents}`);
    }
  }

  console.log("\n  Listo.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
