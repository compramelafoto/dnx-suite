import { prisma } from "@repo/db";
import { getCheckoutServiceReady } from "@/lib/checkout/actions/runtime";

export type PaymentsReconciliationBatchResult = {
  ok: true;
  scanned: number;
  reconciled: number;
  repaired: number;
  manualReview: number;
  errors: number;
  /** Inscripciones abandonadas que se revisaron contra el proveedor. */
  rescueScanned: number;
  /** Inscripciones cuyo pago estaba realmente cobrado y se confirmaron. */
  rescued: number;
  rescuedIds: string[];
  registrationIds: string[];
  startedAt: string;
  finishedAt: string;
};

/**
 * Ventana de rescate: cuántos días hacia atrás se le vuelve a preguntar al
 * proveedor por una inscripción abandonada. Acotada para no barrer la historia
 * entera en cada corrida.
 */
const RESCUE_WINDOW_DAYS = Number(process.env.CLICKATON_RESCUE_WINDOW_DAYS ?? "30");

/**
 * Durable batch en dos pasadas:
 *
 *  1. RESCATE — inscripciones con orden de pago que el sistema dio por perdidas
 *     (reserva vencida, cancelada, revisión manual). Le PREGUNTA a Mercado Pago
 *     si el pago existe y, si está aprobado, confirma.
 *  2. RECONCILIACIÓN — inscripciones vivas: chequeo de consistencia.
 *
 * Por qué la pasada 1: hasta ahora el cron sólo miraba PENDING/PROCESSING, así
 * que una vez vencida la reserva nadie volvía a preguntar nunca. Con el webhook
 * de Mercado Pago rechazado por firma, eso dejaba plata cobrada sin impactar.
 */
export async function runPaymentsReconciliationBatch(opts?: {
  limit?: number;
  cursorId?: string | null;
  /** Permite desactivar la pasada de rescate (diagnóstico). */
  rescue?: boolean;
}): Promise<PaymentsReconciliationBatchResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100);
  const startedAt = new Date();

  // getCheckoutServiceReady (no getCheckoutService): calienta el token OAuth del
  // cobrador desde el vault. Sin él la consulta S2S al proveedor no tiene con qué
  // autenticarse y el rescate sería ciego.
  const checkout = await getCheckoutServiceReady();

  let rescueScanned = 0;
  let rescued = 0;
  const rescuedIds: string[] = [];

  if (opts?.rescue !== false) {
    const desde = new Date(startedAt.getTime() - RESCUE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const abandonadas = await prisma.clickatonRegistration.findMany({
      where: {
        paymentOrderId: { not: null },
        createdAt: { gte: desde },
        status: { in: ["PENDING_PAYMENT", "CANCELLED", "DRAFT"] },
        paymentStatus: { in: ["EXPIRED", "CANCELLED", "MANUAL_REVIEW", "PENDING", "PROCESSING"] },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: { id: true },
    });

    for (const row of abandonadas) {
      rescueScanned += 1;
      try {
        const res = await checkout.rescueRegistrationPayment({
          registrationId: row.id,
          source: "payments_rescue_cron",
        });
        if (res.outcome === "RESCUED") {
          rescued += 1;
          rescuedIds.push(row.id);
        }
        // Sólo se audita cuando hubo algo que contar: un "no pagó" por
        // inscripción cada 10 minutos inundaría la auditoría.
        if (res.outcome !== "NOT_PAID" && res.outcome !== "ALREADY_CONFIRMED") {
          await prisma.clickatonRegistrationAudit.create({
            data: {
              registrationId: row.id,
              action: "PAYMENT_RESCUE_CRON",
              source: "payments_rescue_cron",
              metadata: {
                outcome: res.outcome,
                paymentOrderId: res.paymentOrderId,
                detail: res.detail ?? null,
              },
            },
          });
        }
      } catch (err) {
        try {
          await prisma.clickatonRegistrationAudit.create({
            data: {
              registrationId: row.id,
              action: "PAYMENT_RESCUE_CRON_ERROR",
              source: "payments_rescue_cron",
              metadata: {
                error: err instanceof Error ? err.message.slice(0, 120) : "rescue_threw",
              },
            },
          });
        } catch {
          // ignore audit failure
        }
      }
    }
  }

  const rows = await prisma.clickatonRegistration.findMany({
    where: {
      paymentStatus: { in: ["PENDING", "PROCESSING"] },
      paymentOrderId: { not: null },
      status: { in: ["PENDING_PAYMENT", "CONFIRMED"] },
      ...(opts?.cursorId ? { id: { gt: opts.cursorId } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
    select: { id: true },
  });

  let reconciled = 0;
  let repaired = 0;
  let manualReview = 0;
  let errors = 0;
  const registrationIds: string[] = [];

  for (const row of rows) {
    registrationIds.push(row.id);
    try {
      const result = await checkout.reconcileRegistration(row.id);
      if (result.status === "CONSISTENT") reconciled += 1;
      else if (result.status === "REPAIRED") repaired += 1;
      else manualReview += 1;

      await prisma.clickatonRegistrationAudit.create({
        data: {
          registrationId: row.id,
          action: "PAYMENT_RECONCILE_CRON",
          source: "payments_reconciliation_cron",
          metadata: {
            status: result.status,
            findings: result.findings.slice(0, 10),
            actions: result.actions.slice(0, 10),
          },
        },
      });
    } catch {
      errors += 1;
      try {
        await prisma.clickatonRegistrationAudit.create({
          data: {
            registrationId: row.id,
            action: "PAYMENT_RECONCILE_CRON_ERROR",
            source: "payments_reconciliation_cron",
            metadata: { error: "reconcile_threw" },
          },
        });
      } catch {
        // ignore audit failure
      }
    }
  }

  const finishedAt = new Date();
  return {
    ok: true,
    scanned: rows.length,
    reconciled,
    repaired,
    manualReview,
    errors,
    rescueScanned,
    rescued,
    rescuedIds,
    registrationIds,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
  };
}

export async function getPaymentsReconciliationDiagnostics(): Promise<{
  lastRunAt: string | null;
  recentErrors: number;
  pendingPaymentOrders: number;
}> {
  const [last, recentErrors, pendingPaymentOrders] = await Promise.all([
    prisma.clickatonRegistrationAudit.findFirst({
      where: { action: "PAYMENT_RECONCILE_CRON" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
    prisma.clickatonRegistrationAudit.count({
      where: {
        action: "PAYMENT_RECONCILE_CRON_ERROR",
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.clickatonRegistration.count({
      where: {
        paymentStatus: { in: ["PENDING", "PROCESSING"] },
        paymentOrderId: { not: null },
      },
    }),
  ]);

  return {
    lastRunAt: last?.createdAt.toISOString() ?? null,
    recentErrors,
    pendingPaymentOrders,
  };
}
