import { prisma } from "@repo/db";
import { getCheckoutService } from "@/lib/checkout/actions/runtime";

export type PaymentsReconciliationBatchResult = {
  ok: true;
  scanned: number;
  reconciled: number;
  repaired: number;
  manualReview: number;
  errors: number;
  registrationIds: string[];
  startedAt: string;
  finishedAt: string;
};

/**
 * Durable batch: PENDING/PROCESSING paid registrations with a paymentOrderId.
 * Never marks PAID without provider consult (delegates to reconcile use case).
 */
export async function runPaymentsReconciliationBatch(opts?: {
  limit?: number;
  cursorId?: string | null;
}): Promise<PaymentsReconciliationBatchResult> {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 100);
  const startedAt = new Date();

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

  const checkout = getCheckoutService();
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
