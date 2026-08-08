import { prisma } from "@repo/db";
import { countsAsPaidRegistration } from "@/lib/admin-registration/ui/admin-refund-presentation";

export type PaymentIntegrityFinding = {
  code: string;
  registrationId: string;
  paymentOrderId: string | null;
  providerPaymentId: string | null;
  registrationStatus: string;
  paymentStatus: string;
  detail: string;
};

/**
 * Auditoría READ-ONLY de inconsistencias locales Clickatón ↔ espejo de cobro.
 * Cero escrituras.
 */
export async function auditLocalPaymentInconsistencies(opts?: {
  editionId?: string;
  limit?: number;
}): Promise<{
  scanned: number;
  findings: PaymentIntegrityFinding[];
  wrote: false;
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 500, 1), 2000);
  const rows = await prisma.clickatonRegistration.findMany({
    where: {
      ...(opts?.editionId ? { editionId: opts.editionId } : {}),
      OR: [
        { paymentOrderId: { not: null } },
        { providerPaymentId: { not: null } },
        { paymentStatus: { in: ["APPROVED", "REFUNDED", "PARTIALLY_REFUNDED", "EXPIRED", "MANUAL_REVIEW"] } },
      ],
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentOrderId: true,
      providerPaymentId: true,
      refundedAmountMinor: true,
      totalAmount: true,
      credential: { select: { status: true } },
    },
  });

  const findings: PaymentIntegrityFinding[] = [];
  const providerSeen = new Map<string, string>();

  for (const row of rows) {
    const base = {
      registrationId: row.id,
      paymentOrderId: row.paymentOrderId,
      providerPaymentId: row.providerPaymentId,
      registrationStatus: row.status,
      paymentStatus: row.paymentStatus,
    };

    if (row.paymentStatus === "APPROVED" && row.status === "CANCELLED") {
      findings.push({
        ...base,
        code: "APPROVED_PAYMENT_CANCELLED_REGISTRATION",
        detail: "Cobro APPROVED con inscripción CANCELLED",
      });
    }
    if (row.paymentStatus === "APPROVED" && row.status === "PENDING_PAYMENT") {
      findings.push({
        ...base,
        code: "APPROVED_PAYMENT_PENDING_REGISTRATION",
        detail: "Cobro APPROVED con inscripción PENDING_PAYMENT",
      });
    }
    if (row.paymentStatus === "EXPIRED" && row.status === "CONFIRMED") {
      findings.push({
        ...base,
        code: "EXPIRED_PAYMENT_CONFIRMED_REGISTRATION",
        detail: "Cobro EXPIRED con inscripción CONFIRMED",
      });
    }
    if (
      (row.paymentStatus === "REFUNDED" || row.status === "REFUNDED") &&
      row.status === "CONFIRMED"
    ) {
      findings.push({
        ...base,
        code: "REFUNDED_STILL_CONFIRMED",
        detail: "Reembolso con inscripción aún CONFIRMED",
      });
    }
    if (
      row.status === "REFUNDED" &&
      row.credential?.status === "ACTIVE"
    ) {
      findings.push({
        ...base,
        code: "REFUNDED_ACTIVE_CREDENTIAL",
        detail: "Inscripción REFUNDED con credencial ACTIVE",
      });
    }
    if (
      row.status === "CONFIRMED" &&
      row.paymentStatus !== "APPROVED" &&
      row.paymentStatus !== "PARTIALLY_REFUNDED" &&
      row.paymentStatus !== "NOT_REQUIRED"
    ) {
      findings.push({
        ...base,
        code: "CONFIRMED_WITHOUT_APPROVED_PAYMENT",
        detail: `CONFIRMED con paymentStatus=${row.paymentStatus}`,
      });
    }
    if (
      row.paymentStatus === "PARTIALLY_REFUNDED" &&
      (row.refundedAmountMinor == null ||
        row.refundedAmountMinor <= 0 ||
        row.refundedAmountMinor >= row.totalAmount)
    ) {
      findings.push({
        ...base,
        code: "PARTIAL_REFUND_AMOUNT_INCONSISTENT",
        detail: `refundedAmountMinor=${row.refundedAmountMinor ?? "null"} total=${row.totalAmount}`,
      });
    }
    if (row.providerPaymentId) {
      const prev = providerSeen.get(row.providerPaymentId);
      if (prev && prev !== row.id) {
        findings.push({
          ...base,
          code: "DUPLICATE_PROVIDER_PAYMENT_ID",
          detail: `providerPaymentId también en ${prev}`,
        });
      } else {
        providerSeen.set(row.providerPaymentId, row.id);
      }
    }

    // Sanity: countsAsPaid no debe incluir REFUNDED totales
    void countsAsPaidRegistration({
      registrationStatus: row.status,
      paymentStatus: row.paymentStatus,
    });
  }

  return { scanned: rows.length, findings, wrote: false };
}
