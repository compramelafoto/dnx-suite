import "server-only";
import { prisma } from "@repo/db";
import { allocatePayment } from "./allocate";
import { decimalArsToMinor, minorToDecimalString } from "./money";
import type { OpenCharge } from "./select-charges";
import { accrualForManualPayment } from "@/lib/platform-fee/debt";
import { recordAccrual } from "@/lib/platform-fee/ledger";
import { releasePaidPrintOrders } from "@/lib/carnet/print-order";

/** Medios que la Secretaría puede registrar a mano. Mercado Pago entra solo, por webhook. */
export const MANUAL_METHODS = ["EFECTIVO", "TRANSFERENCIA"] as const;
export type ManualMethod = (typeof MANUAL_METHODS)[number];

export type ManualPaymentResult =
  | {
      ok: true;
      paymentId: string;
      /** Lo que se pudo imputar a cuotas, en centavos. */
      appliedMinor: number;
      /** Lo que sobró y quedó a favor del socio. */
      unappliedMinor: number;
      /** Comisión que la institución le queda debiendo a la plataforma. */
      accruedFeeMinor: number;
    }
  | { ok: false; error: string };

/**
 * Registra un pago que no pasó por Mercado Pago.
 *
 * La institución cobró en mano, así que la plataforma no pudo retener su comisión en la
 * operación. Esa comisión queda asentada como deuda y se cobra de los siguientes pagos que sí
 * entren por Mercado Pago.
 *
 * Solo devenga comisión la parte imputada a cuotas que la cobran: un pago que salda el cargo
 * de apertura —deuda traída del sistema anterior— no genera deuda de fee.
 *
 * Todo pasa en una sola transacción. Un pago registrado sin bajar la deuda dejaría al socio
 * figurando como deudor de algo que ya pagó.
 */
export async function registerManualPayment(input: {
  workspaceId: string;
  memberId: string;
  amountMinor: number;
  method: ManualMethod;
  paidAt: Date;
  reference: string | null;
  feeBps: number;
  feeSincePeriod: string;
}): Promise<ManualPaymentResult> {
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    return { ok: false, error: "El importe tiene que ser mayor que cero." };
  }

  const socio = await prisma.member.findFirst({
    where: { id: input.memberId, workspaceId: input.workspaceId },
    select: { id: true },
  });
  if (!socio) return { ok: false, error: "Ese socio no pertenece a esta institución." };

  const resultado = await prisma.$transaction(async (tx) => {
    // La deuda se lee dentro de la transacción: entre que se abrió el formulario y se confirmó
    // pudo generarse la cuota del mes o acreditarse un pago de Mercado Pago.
    const filas = await tx.membershipCharge.findMany({
      where: { memberId: input.memberId, balanceArs: { gt: 0 } },
      select: { id: true, concept: true, period: true, dueDate: true, balanceArs: true },
    });
    const abiertos: OpenCharge[] = filas.map((f) => ({
      id: f.id,
      concept: String(f.concept),
      period: f.period,
      dueDate: f.dueDate,
      balanceMinor: decimalArsToMinor(f.balanceArs),
    }));
    const periodoDe = new Map(abiertos.map((c) => [c.id, c.period]));

    const plan = allocatePayment({ amountMinor: input.amountMinor, charges: abiertos });
    const imputado = plan.allocations.reduce((s, a) => s + a.principalMinor, 0);

    const feeMinor = accrualForManualPayment(
      plan.allocations.map((a) => ({
        period: periodoDe.get(a.chargeId) ?? "",
        amountMinor: a.principalMinor,
      })),
      input.feeBps,
      input.feeSincePeriod,
    );

    const pago = await tx.membershipPayment.create({
      data: {
        workspaceId: input.workspaceId,
        memberId: input.memberId,
        amountArs: minorToDecimalString(input.amountMinor),
        // El fee no se descuenta de lo que recibió la institución: ya cobró todo en mano.
        // Queda como deuda, no como retención.
        platformFeeArs: minorToDecimalString(feeMinor),
        netAmountArs: minorToDecimalString(input.amountMinor),
        status: "ACREDITADO",
        method: input.method,
        providerOrderRef: input.reference,
        paidAt: input.paidAt,
      },
      select: { id: true },
    });

    for (const im of plan.allocations) {
      await tx.membershipCharge.update({
        where: { id: im.chargeId },
        data: { balanceArs: minorToDecimalString(im.remainingMinor) },
      });
      await tx.membershipAllocation.create({
        data: {
          paymentId: pago.id,
          chargeId: im.chargeId,
          principalArs: minorToDecimalString(im.principalMinor),
        },
      });
    }

    await recordAccrual(tx, {
      workspaceId: input.workspaceId,
      membershipPaymentId: pago.id,
      amountMinor: feeMinor,
      note: `Comisión no retenida: cobro por ${input.method.toLowerCase()}`,
    });

    return {
      paymentId: pago.id,
      appliedMinor: imputado,
      unappliedMinor: plan.unappliedMinor,
      accruedFeeMinor: feeMinor,
    };
  });

  // Fuera de la transacción: que el pago se haya imputado ya es cierto, y no poder mover una
  // tarjeta a la cola de impresión no puede deshacerlo.
  try {
    await releasePaidPrintOrders(input.memberId);
  } catch (error) {
    console.error("[fotoffice][cuotas] no se pudo liberar la tarjeta impresa", {
      paymentId: resultado.paymentId,
      detalle: error instanceof Error ? error.message : String(error),
    });
  }

  return { ok: true, ...resultado };
}
