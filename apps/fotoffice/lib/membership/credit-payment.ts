import "server-only";
import { prisma } from "@repo/db";
import { allocatePayment } from "./allocate";
import { decimalArsToMinor, minorToDecimalString } from "./money";
import type { OpenCharge } from "./select-charges";
import { outcomeForProviderStatus, shouldApply, type StoredPaymentStatus } from "./payment-outcome";
import { releasePaidPrintOrders } from "@/lib/carnet/print-order";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { pendingFeeDebtMinor, recordDischarge, recordReversal } from "@/lib/platform-fee/ledger";

export type CreditResult =
  | { ok: true; applied: boolean; motivo: string }
  | { ok: false; motivo: string };

/**
 * Aplica lo que informa MercadoPago sobre un pago.
 *
 * **Todo pasa en una sola transacción.** Un pago acreditado a medias —el pago marcado como
 * cobrado pero los cargos sin bajar— es peor que uno no acreditado: el socio figura al día y
 * la deuda sigue ahí.
 */
export async function creditMembershipPayment(input: {
  /** El `external_reference` de la preferencia: el id de la intención de pago. */
  paymentId: string;
  providerPaymentRef: string;
  providerStatus: string;
  /** Importe que MercadoPago dice haber cobrado, en centavos. */
  paidAmountMinor: number;
  paidAt: Date;
}): Promise<CreditResult> {
  const outcome = outcomeForProviderStatus(input.providerStatus);

  const intento = await prisma.membershipPayment.findUnique({
    where: { id: input.paymentId },
    select: {
      id: true,
      memberId: true,
      status: true,
      amountArs: true,
      workspaceId: true,
      platformFeeArs: true,
    },
  });
  if (!intento) {
    return { ok: false, motivo: "no existe la intención de pago" };
  }

  if (!shouldApply({ current: intento.status as StoredPaymentStatus, outcome })) {
    return { ok: true, applied: false, motivo: `${outcome} sobre ${intento.status}: nada que hacer` };
  }

  if (outcome === "RECHAZAR") {
    await prisma.membershipPayment.update({
      where: { id: intento.id },
      data: { status: "RECHAZADO", providerPaymentRef: input.providerPaymentRef },
    });
    return { ok: true, applied: true, motivo: "pago rechazado" };
  }

  if (outcome === "REVERTIR") {
    await prisma.$transaction(async (tx) => {
      const imputaciones = await tx.membershipAllocation.findMany({
        where: { paymentId: intento.id },
        select: { chargeId: true, principalArs: true },
      });
      for (const im of imputaciones) {
        // Se devuelve el saldo al cargo. No se toca la condición del socio: un contracargo
        // no expulsa a nadie, lo vuelve a dejar debiendo.
        await tx.membershipCharge.update({
          where: { id: im.chargeId },
          data: { balanceArs: { increment: im.principalArs } },
        });
      }
      await tx.membershipAllocation.deleteMany({ where: { paymentId: intento.id } });

      // La comisión ajena que este pago había cancelado vuelve a quedar pendiente: se retuvo
      // sobre plata que volvió al socio. Sin esto la deuda desaparecería sin haberse cobrado.
      const retenido = await tx.workspaceFeeLedgerEntry.aggregate({
        where: { membershipPaymentId: intento.id, kind: "RETENIDO" },
        _sum: { amountArs: true },
      });
      const aDevolver = retenido._sum.amountArs
        ? Math.abs(decimalArsToMinor(retenido._sum.amountArs))
        : 0;
      await recordReversal(tx, {
        workspaceId: intento.workspaceId,
        membershipPaymentId: intento.id,
        amountMinor: aDevolver,
        note: "Pago reembolsado: la comisión arrastrada vuelve a quedar pendiente",
      });

      await tx.membershipPayment.update({
        where: { id: intento.id },
        data: { status: "RECHAZADO", paidAt: null },
      });
    });
    return { ok: true, applied: true, motivo: "pago revertido" };
  }

  // ACREDITAR.
  await prisma.$transaction(async (tx) => {
    // La deuda se lee DENTRO de la transacción y en este instante, no la que había cuando el
    // socio arrancó el checkout: entre medio la Secretaría pudo registrar un pago en efectivo
    // o pudo generarse la cuota del mes.
    const filas = await tx.membershipCharge.findMany({
      where: { memberId: intento.memberId, balanceArs: { gt: 0 } },
      select: { id: true, concept: true, period: true, dueDate: true, balanceArs: true },
    });
    const abiertos: OpenCharge[] = filas.map((f) => ({
      id: f.id,
      concept: String(f.concept),
      period: f.period,
      dueDate: f.dueDate,
      balanceMinor: decimalArsToMinor(f.balanceArs),
    }));

    const plan = allocatePayment({ amountMinor: input.paidAmountMinor, charges: abiertos });

    for (const im of plan.allocations) {
      await tx.membershipCharge.update({
        where: { id: im.chargeId },
        data: { balanceArs: minorToDecimalString(im.remainingMinor) },
      });
      await tx.membershipAllocation.create({
        data: {
          paymentId: intento.id,
          chargeId: im.chargeId,
          principalArs: minorToDecimalString(im.principalMinor),
        },
      });
    }

    await tx.membershipPayment.update({
      where: { id: intento.id },
      data: {
        status: "ACREDITADO",
        providerPaymentRef: input.providerPaymentRef,
        paidAt: input.paidAt,
      },
    });

    // De lo retenido, una parte es la comisión de este pago y el resto canceló deuda dejada por
    // cobros en efectivo o transferencia. Solo esa segunda parte se asienta en el libro.
    const feeBps = await getPlatformFeeBps(intento.workspaceId, MEMBERS_MODULE_KEY);
    const propioMinor = splitMinorByPlatformFee(
      decimalArsToMinor(intento.amountArs),
      feeBps,
    ).feeMinor;
    const retenidoMinor = decimalArsToMinor(intento.platformFeeArs);
    // Se acota contra la deuda de este instante: entre que se armó el checkout y llegó el aviso
    // otro pago pudo haberla cancelado, y el libro no puede quedar en negativo.
    const pendiente = await pendingFeeDebtMinor(intento.workspaceId, tx);
    const aCancelar = Math.max(0, Math.min(retenidoMinor - propioMinor, pendiente));
    await recordDischarge(tx, {
      workspaceId: intento.workspaceId,
      membershipPaymentId: intento.id,
      amountMinor: aCancelar,
      note: "Comisión arrastrada, cobrada de este pago",
    });
  });

  // Fuera de la transacción a propósito: si el pago se imputó, eso ya es cierto, y no poder
  // mover una tarjeta a la cola de impresión no puede deshacerlo. La conciliación vuelve a
  // pasar por acá si quedó a medias.
  try {
    await releasePaidPrintOrders(intento.memberId);
  } catch (error) {
    console.error("[fotoffice][cuotas] no se pudo liberar la tarjeta impresa", {
      paymentId: intento.id,
      detalle: error instanceof Error ? error.message : String(error),
    });
  }

  return { ok: true, applied: true, motivo: "pago acreditado" };
}
