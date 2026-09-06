import "server-only";
import { prisma } from "@repo/db";
import { loadMemberBalance } from "./balance";
import { planCreditApplication } from "./apply-credit";
import { decimalArsToMinor, minorToDecimalString } from "./money";

/**
 * Consume el saldo a favor del socio contra sus cargos abiertos.
 *
 * **Idempotente.** El crédito se relee de la base en cada corrida, así que una segunda
 * ejecución no encuentra nada que imputar. La imputación usa `upsert` porque un pago puede
 * llegar a un cargo en dos tandas —la clave `[paymentId, chargeId]` es única— y en ese caso
 * corresponde sumar, no fallar.
 *
 * Todo en una transacción: un cargo bajado sin su imputación dejaría plata sin rastro.
 */
export async function applyCreditForMember(
  memberId: string,
): Promise<{ appliedMinor: number; chargesTouched: number }> {
  const saldo = await loadMemberBalance(memberId);
  if (saldo.creditMinor <= 0 || saldo.charges.length === 0) {
    return { appliedMinor: 0, chargesTouched: 0 };
  }

  const plan = planCreditApplication({ credits: saldo.openCredits, charges: saldo.charges });
  if (plan.length === 0) return { appliedMinor: 0, chargesTouched: 0 };

  await prisma.$transaction(async (tx) => {
    for (const im of plan) {
      // Se lee lo ya imputado y se escribe el total, en vez de un `increment`: incrementar
      // un `Decimal` con un string es un tipo que Prisma no garantiza, y acá se suma plata.
      // Estar dentro de la transacción hace que leer y escribir no se puedan separar.
      const previa = await tx.membershipAllocation.findUnique({
        where: { paymentId_chargeId: { paymentId: im.paymentId, chargeId: im.chargeId } },
        select: { principalArs: true },
      });
      const totalMinor = (previa ? decimalArsToMinor(previa.principalArs) : 0) + im.amountMinor;

      await tx.membershipAllocation.upsert({
        where: { paymentId_chargeId: { paymentId: im.paymentId, chargeId: im.chargeId } },
        create: {
          paymentId: im.paymentId,
          chargeId: im.chargeId,
          principalArs: minorToDecimalString(im.amountMinor),
        },
        update: { principalArs: minorToDecimalString(totalMinor) },
      });
      await tx.membershipCharge.update({
        where: { id: im.chargeId },
        data: { balanceArs: minorToDecimalString(im.chargeRemainingMinor) },
      });
    }
  });

  return {
    appliedMinor: plan.reduce((s, a) => s + a.amountMinor, 0),
    chargesTouched: new Set(plan.map((a) => a.chargeId)).size,
  };
}

/**
 * Lo mismo para toda la institución. Se corre después de generar las cuotas del mes: el socio
 * que tenía crédito no puede recibir un reclamo por una cuota que su saldo ya cubre.
 *
 * De a uno y no en una transacción gigante, igual que la generación: si falla el socio 100,
 * los 99 anteriores ya quedaron bien y volver a correrlo no los toca.
 */
export async function applyCreditForWorkspace(
  workspaceId: string,
): Promise<{ membersTouched: number; appliedMinor: number }> {
  const socios = await prisma.member.findMany({
    where: { workspaceId, payments: { some: { status: "ACREDITADO" } } },
    select: { id: true },
  });

  let membersTouched = 0;
  let appliedMinor = 0;
  for (const s of socios) {
    const r = await applyCreditForMember(s.id);
    if (r.appliedMinor > 0) {
      membersTouched += 1;
      appliedMinor += r.appliedMinor;
    }
  }
  return { membersTouched, appliedMinor };
}
