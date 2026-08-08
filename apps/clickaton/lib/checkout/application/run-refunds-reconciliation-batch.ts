import { prisma } from "@repo/db";
import { reconcileRefundFromProviderPayment } from "@/lib/checkout/refunds/reconcile-refund";
import { resolveRefundReconcileMode } from "@/lib/checkout/refunds/flags";

export type RefundsReconciliationBatchResult = {
  ok: true;
  mode: "disabled" | "shadow" | "apply";
  scanned: number;
  repaired: number;
  consistent: number;
  errors: number;
  registrationIds: string[];
  startedAt: string;
  finishedAt: string;
};

/**
 * Lote acotado: inscripciones CONFIRMED+APPROVED (o parciales) con paymentOrderId.
 * Detecta refunds MP perdidos. Respeta feature flags (prod off por default).
 */
export async function runRefundsReconciliationBatch(opts?: {
  limit?: number;
  cursorId?: string | null;
}): Promise<RefundsReconciliationBatchResult> {
  const mode = resolveRefundReconcileMode();
  const limit = Math.min(Math.max(opts?.limit ?? 15, 1), 40);
  const startedAt = new Date();

  if (mode === "disabled") {
    return {
      ok: true,
      mode,
      scanned: 0,
      repaired: 0,
      consistent: 0,
      errors: 0,
      registrationIds: [],
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
    };
  }

  const rows = await prisma.clickatonRegistration.findMany({
    where: {
      paymentOrderId: { not: null },
      status: { in: ["CONFIRMED", "REFUNDED"] },
      paymentStatus: { in: ["APPROVED", "PARTIALLY_REFUNDED", "REFUNDED"] },
      ...(opts?.cursorId ? { id: { gt: opts.cursorId } } : {}),
    },
    orderBy: { id: "asc" },
    take: limit,
    select: {
      id: true,
      providerPaymentId: true,
      paymentStatus: true,
    },
  });

  let repaired = 0;
  let consistent = 0;
  let errors = 0;
  const registrationIds: string[] = [];

  for (const row of rows) {
    registrationIds.push(row.id);
    try {
      const plan = await reconcileRefundFromProviderPayment({
        registrationId: row.id,
        providerPaymentId: row.providerPaymentId ?? undefined,
        dryRun: mode !== "apply",
      });

      if (plan.error) {
        errors += 1;
      } else if (
        plan.detected &&
        (plan.detected.kind === "total" || plan.detected.kind === "partial") &&
        plan.changes.some((c) => c.includes("→") || c.startsWith("applied"))
      ) {
        if (mode === "apply" && plan.applied) repaired += 1;
        else if (mode === "shadow") repaired += 1; // would-repair
        else consistent += 1;
      } else {
        consistent += 1;
      }

      await prisma.clickatonRegistrationAudit.create({
        data: {
          registrationId: row.id,
          action: "PAYMENT_REFUND_RECONCILE_CRON",
          source: "refunds_reconciliation_cron",
          metadata: {
            mode,
            error: plan.error ?? null,
            detected: plan.detected,
            changes: plan.changes.slice(0, 10),
            applied: plan.applied,
            providerPaymentId: plan.providerPaymentId || null,
          },
        },
      });
    } catch {
      errors += 1;
      try {
        await prisma.clickatonRegistrationAudit.create({
          data: {
            registrationId: row.id,
            action: "PAYMENT_REFUND_RECONCILE_CRON_ERROR",
            source: "refunds_reconciliation_cron",
            metadata: { mode, error: "reconcile_threw" },
          },
        });
      } catch {
        // ignore
      }
    }

    // Pacing suave para no saturar MP
    await new Promise((r) => setTimeout(r, 120));
  }

  return {
    ok: true,
    mode,
    scanned: rows.length,
    repaired,
    consistent,
    errors,
    registrationIds,
    startedAt: startedAt.toISOString(),
    finishedAt: new Date().toISOString(),
  };
}
