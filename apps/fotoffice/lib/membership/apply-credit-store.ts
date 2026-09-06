import "server-only";
import { prisma } from "@repo/db";
import { creditFromPayments, type PaymentForCredit } from "./credit";
import { planCreditApplication } from "./apply-credit";
import { decimalArsToMinor, minorToDecimalString } from "./money";
import type { OpenCharge } from "./select-charges";

/**
 * Consume el saldo a favor del socio contra sus cargos abiertos.
 *
 * **Todo —la lectura que decide y la escritura que actúa— pasa DENTRO de la misma
 * transacción.** La primera versión leía el saldo (`loadMemberBalance`) afuera y sólo la
 * escritura entraba en el `$transaction`. Con `generateMonthlyCharges` disparable por cron y por
 * botón, dos corridas para el mismo socio podían solaparse: las dos leían el mismo saldo viejo,
 * armaban el mismo plan, y la segunda -al reabrir su propia lectura de "cuánto hay imputado"-
 * terminaba sumando su parte encima de lo que la primera ya había escrito, imputando dos veces el
 * mismo pago al mismo cargo. Acá no hay ventana entre leer y escribir en la que la otra corrida
 * pueda meterse: es una sola operación atómica, con los datos releídos con `tx` en este instante.
 *
 * La imputación usa `create`, no `upsert` con suma. Un plan armado con datos recién leídos DENTRO
 * de esta misma transacción nunca propone un par `(paymentId, chargeId)` que ya tenga imputación:
 * el saldo de cada pago ya sale neto de todo lo imputado antes (`allocatedMinor`, sumado sobre
 * TODAS sus imputaciones), y el saldo de cada cargo es el que quedó después de la última baja. Si
 * el `create` choca contra la restricción única `[paymentId, chargeId]` de todos modos, sólo puede
 * ser porque otra corrida -para este mismo socio, en este mismo instante- ganó la carrera y ya
 * escribió esa fila. Postgres corta ahí: la transacción entera se aborta sin dejar nada a medias
 * (ni la imputación a mitad de camino ni el cargo bajado de más), y se lo trata como "no hay nada
 * para aplicar" (`appliedMinor: 0`) -lo que esta corrida iba a aportar, la otra ya lo aportó.
 */
export async function applyCreditForMember(
  memberId: string,
): Promise<{ appliedMinor: number; chargesTouched: number }> {
  try {
    return await prisma.$transaction(async (tx) => {
      const [cargos, pagos] = await Promise.all([
        tx.membershipCharge.findMany({
          where: { memberId, balanceArs: { gt: 0 } },
          select: { id: true, concept: true, period: true, dueDate: true, balanceArs: true },
        }),
        tx.membershipPayment.findMany({
          where: { memberId, status: "ACREDITADO" },
          select: {
            id: true,
            method: true,
            providerPaymentRef: true,
            amountArs: true,
            allocations: { select: { principalArs: true } },
          },
          orderBy: { createdAt: "asc" },
        }),
      ]);

      const charges: OpenCharge[] = cargos.map((f) => ({
        id: f.id,
        concept: String(f.concept),
        period: f.period,
        dueDate: f.dueDate,
        balanceMinor: decimalArsToMinor(f.balanceArs),
      }));

      const paraCredito: PaymentForCredit[] = pagos.map((p) => ({
        id: p.id,
        method: p.method,
        providerPaymentRef: p.providerPaymentRef,
        amountMinor: decimalArsToMinor(p.amountArs),
        allocatedMinor: p.allocations.reduce((s, a) => s + decimalArsToMinor(a.principalArs), 0),
      }));

      const { open } = creditFromPayments(paraCredito);
      if (open.length === 0 || charges.length === 0) {
        return { appliedMinor: 0, chargesTouched: 0 };
      }

      const plan = planCreditApplication({ credits: open, charges });
      if (plan.length === 0) return { appliedMinor: 0, chargesTouched: 0 };

      for (const im of plan) {
        await tx.membershipAllocation.create({
          data: {
            paymentId: im.paymentId,
            chargeId: im.chargeId,
            principalArs: minorToDecimalString(im.amountMinor),
          },
        });
        await tx.membershipCharge.update({
          where: { id: im.chargeId },
          data: { balanceArs: minorToDecimalString(im.chargeRemainingMinor) },
        });
      }

      return {
        appliedMinor: plan.reduce((s, a) => s + a.amountMinor, 0),
        chargesTouched: new Set(plan.map((a) => a.chargeId)).size,
      };
    });
  } catch (error) {
    // P2002 sobre `[paymentId, chargeId]`: otra corrida, para este mismo socio y en este mismo
    // instante, ya escribió esta imputación. No es un error de la aplicación: es la carrera
    // resuelta a favor de la otra corrida, y ésta no tiene nada más para aportar.
    if ((error as { code?: string })?.code === "P2002") {
      return { appliedMinor: 0, chargesTouched: 0 };
    }
    throw error;
  }
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
