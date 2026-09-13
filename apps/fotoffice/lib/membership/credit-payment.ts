import "server-only";
import { prisma } from "@repo/db";
import { allocatePayment } from "./allocate";
import { decimalArsToMinor, minorToDecimalString } from "./money";
import type { OpenCharge } from "./select-charges";
import { outcomeForProviderStatus, shouldApply, type StoredPaymentStatus } from "./payment-outcome";
import { releasePaidPrintOrders } from "@/lib/carnet/print-order";
import { completeApplicationIfPaid } from "./complete-application";
import { getPlatformFeeBps } from "@/lib/platform-fee/store";
import { MEMBERS_MODULE_KEY } from "@/lib/members/constants";
import { splitMinorByPlatformFee } from "@/lib/platform-fee/fee";
import { pendingFeeDebtMinor, recordDischarge, recordReversal } from "@/lib/platform-fee/ledger";
import { resolveDepositTarget } from "@/lib/cash/auto-deposit";
import { recordCashMovement } from "@/lib/cash/record-movement";
import { CASH_MODULE_KEY } from "@/lib/cash/constants";
import { isModuleEnabledForWorkspace } from "@/lib/modules/gating";

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
      member: { select: { memberNumber: true } },
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

    // Depositar en Caja, si el workspace la tiene encendida. Mismo criterio que el cobro en
    // mano: la decisión de a dónde entra —o si no corresponde depositar— se toma antes y
    // adentro de esta misma transacción, para que el pago y su asiento nazcan juntos. La
    // idempotencia de `recordCashMovement` hace que un aviso de MercadoPago repetido —el
    // caso normal— no duplique el depósito.
    //
    // Por qué se pregunta si Caja está habilitada ANTES de tocar `cashAccount`/`cashCategory`:
    // esas tablas las trae una migración que en este repo se aplica a mano, después del deploy
    // del código (no hay `migrate deploy` automático). Si el código sale antes que la
    // migración, un `findMany` contra una tabla ausente rompe con un error de Postgres DENTRO
    // de esta transacción y voltea la acreditación completa — el pago quedaría sin acreditar
    // en TODOS los workspaces, tengan Caja encendida o no. Cortar acá antes de cualquier
    // consulta a Caja hace que ese despliegue desordenado sea inofensivo.
    //
    // `recordCashMovement` lanza si el importe no es mayor que cero, y eso volcaría toda la
    // acreditación del pago: se resguarda acá también, aunque un pago de $0 no debería llegar
    // nunca.
    const cashEnabled = await isModuleEnabledForWorkspace(intento.workspaceId, CASH_MODULE_KEY);
    if (cashEnabled && input.paidAmountMinor > 0) {
      const destino = resolveDepositTarget({
        cashEnabled,
        paymentMethod: "MERCADO_PAGO",
        accounts: await tx.cashAccount.findMany({
          where: { workspaceId: intento.workspaceId, isActive: true },
          select: { id: true, name: true, kind: true, isDefault: true },
          orderBy: { order: "asc" },
        }),
        categories: await tx.cashCategory.findMany({
          where: { workspaceId: intento.workspaceId, kind: "INGRESO", isActive: true },
          select: { id: true, name: true, kind: true },
        }),
        categoryName: "Cuotas",
      });

      if (destino.ok) {
        await recordCashMovement(tx, {
          workspaceId: intento.workspaceId,
          accountId: destino.accountId,
          categoryId: destino.categoryId,
          kind: "INGRESO",
          amountMinor: input.paidAmountMinor,
          occurredAt: input.paidAt,
          description: `Cuota — socio ${intento.member.memberNumber}`,
          paymentMethod: "MERCADO_PAGO",
          sourceModule: "membership",
          sourceRef: intento.id,
        });
      }
    }
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

  // Si este pago era el que faltaba, cierra el alta: marca la solicitud como completada, emite
  // el carnet digital y le da la bienvenida. Nunca lanza.
  await completeApplicationIfPaid(intento.memberId);

  return { ok: true, applied: true, motivo: "pago acreditado" };
}
