/**
 * Verifica por qué el pedido #88 no tiene referido aplicado.
 * Consulta: ReferralAttribution del fotógrafo 129, MP del referrer, fechas.
 * Uso: npx tsx scripts/check-referral-order-88.ts
 */

import { prisma } from "../lib/prisma";

async function main() {
  const orderId = 88;

  const order = await prisma.printOrder.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      photographerId: true,
      paymentStatus: true,
      statusUpdatedAt: true,
      mpPaymentId: true,
      createdAt: true,
      photographer: { select: { id: true, name: true, email: true } },
    },
  });

  if (!order) {
    console.log("No existe PrintOrder 88.");
    return;
  }

  console.log("\n=== PEDIDO #88 ===\n");
  console.log("Fotógrafo:", order.photographer?.name, "| userId:", order.photographerId, "| email:", order.photographer?.email);
  console.log("Estado pago:", order.paymentStatus);
  console.log("Creado:", order.createdAt);
  console.log("statusUpdatedAt (aprox. pago):", order.statusUpdatedAt);
  console.log("mpPaymentId:", order.mpPaymentId ?? "—");

  const referredUserId = order.photographerId;
  if (!referredUserId) {
    console.log("\nNo hay photographerId → pedido sin fotógrafo (ej. flujo público). No aplica referido.");
    return;
  }

  const attributions = await prisma.referralAttribution.findMany({
    where: { referredUserId },
    orderBy: { createdAt: "desc" },
    include: {
      referrerUser: {
        select: {
          id: true,
          name: true,
          email: true,
          mpUserId: true,
          mpConnectedAt: true,
        },
      },
      referralCode: { select: { code: true } },
    },
  });

  console.log("\n=== ATRIBUCIONES DE REFERIDO (referredUserId = " + referredUserId + ") ===\n");

  if (attributions.length === 0) {
    console.log("No hay ninguna ReferralAttribution para este fotógrafo.");
    console.log("→ El fotógrafo no se registró con ?ref=CODE (o no pasó las validaciones: referrer con MP, email distinto, etc.).");
    return;
  }

  const paidAt = order.statusUpdatedAt ?? order.createdAt;

  for (const a of attributions) {
    const referrer = a.referrerUser;
    const referrerHasMp = !!(referrer?.mpUserId || referrer?.mpConnectedAt);
    const endsAt = new Date(a.endsAt);
    const stillActive = endsAt > paidAt && a.status === "ACTIVE";

    console.log("--- Atribución id:", a.id, "| código:", a.referralCode?.code ?? "—");
    console.log("  Referrer:", referrer?.name, "| userId:", a.referrerUserId, "| email:", referrer?.email);
    console.log("  Referrer MP conectado:", referrerHasMp, "| mpUserId:", referrer?.mpUserId ?? "—", "| mpConnectedAt:", referrer?.mpConnectedAt ?? "—");
    console.log("  startsAt:", a.startsAt, "| endsAt:", a.endsAt, "| status:", a.status);
    console.log("  ¿Activa en fecha de pago?", stillActive, "(endsAt > paidAt y status ACTIVE)");
    console.log("");

    if (!referrerHasMp) {
      console.log("  → No se aplica referido: el referrer no tiene Mercado Pago conectado.");
    } else if (!stillActive) {
      console.log("  → No se aplica referido: atribución expirada o no activa en la fecha del pago.");
    } else {
      console.log("  → Debería haberse aplicado referido. Revisar webhook o create-preference.");
    }
    console.log("");
  }

  const anyEarning = await prisma.referralEarning.findFirst({
    where: { saleRef: `PRINT_ORDER:${orderId}` },
  });
  console.log("ReferralEarning para PRINT_ORDER:88:", anyEarning ? "SÍ existe" : "NO existe");
  if (anyEarning) {
    console.log(anyEarning);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
