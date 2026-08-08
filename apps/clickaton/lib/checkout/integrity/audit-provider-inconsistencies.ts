import { prisma } from "@repo/db";
import { getDurablePaymentsClientForOps } from "@/lib/checkout/refunds/ops-payments-client";

export type ProviderAuditFinding = {
  code: string;
  registrationId: string;
  paymentOrderId: string | null;
  providerPaymentId: string | null;
  localRegistrationStatus: string;
  localPaymentStatus: string;
  remoteStatus: string | null;
  detail: string;
  error?: string;
};

/**
 * Auditoría READ-ONLY remoto (Mercado Pago) vs local.
 * Nunca escribe. Paginada / con límite de requests.
 */
export async function auditProviderPaymentInconsistencies(opts?: {
  editionId?: string;
  limit?: number;
  paymentId?: string;
  maxRequests?: number;
}): Promise<{
  scanned: number;
  peeked: number;
  findings: ProviderAuditFinding[];
  errors: Array<{ registrationId: string; providerPaymentId: string | null; error: string }>;
  wrote: false;
  createdRefund: false;
}> {
  const limit = Math.min(Math.max(opts?.limit ?? 25, 1), 200);
  const maxRequests = Math.min(Math.max(opts?.maxRequests ?? limit, 1), 200);
  const paymentId = opts?.paymentId?.trim();

  const ops = await getDurablePaymentsClientForOps();
  if (!ops.ok) {
    return {
      scanned: 0,
      peeked: 0,
      findings: [],
      errors: [{ registrationId: "", providerPaymentId: null, error: ops.error }],
      wrote: false,
      createdRefund: false,
    };
  }
  const peek = ops.client.service.peekProviderPayment;
  if (!peek) {
    return {
      scanned: 0,
      peeked: 0,
      findings: [],
      errors: [
        {
          registrationId: "",
          providerPaymentId: null,
          error: "peek_provider_payment_unavailable",
        },
      ],
      wrote: false,
      createdRefund: false,
    };
  }

  let paymentOrderIdsForPid: string[] = [];
  if (paymentId && /^\d+$/.test(paymentId)) {
    const linked = await prisma.dnxProviderOrder.findMany({
      where: { providerOrderId: paymentId },
      select: { paymentOrderId: true },
      take: 20,
    });
    paymentOrderIdsForPid = linked.map((r) => r.paymentOrderId);
  }

  const rows = await prisma.clickatonRegistration.findMany({
    where: {
      ...(opts?.editionId ? { editionId: opts.editionId } : {}),
      ...(paymentId
        ? {
            OR: [
              { providerPaymentId: paymentId },
              ...(paymentOrderIdsForPid.length
                ? [{ paymentOrderId: { in: paymentOrderIdsForPid } }]
                : []),
            ],
          }
        : {
            OR: [
              { providerPaymentId: { not: null } },
              { paymentStatus: { in: ["APPROVED", "EXPIRED", "REFUNDED", "PARTIALLY_REFUNDED"] } },
              { status: { in: ["CONFIRMED", "CANCELLED", "REFUNDED"] } },
            ],
          }),
    },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      paymentOrderId: true,
      providerPaymentId: true,
      paymentExternalReference: true,
    },
  });

  const findings: ProviderAuditFinding[] = [];
  const errors: Array<{
    registrationId: string;
    providerPaymentId: string | null;
    error: string;
  }> = [];
  let peeked = 0;

  for (const row of rows) {
    if (peeked >= maxRequests) break;

    let pid = row.providerPaymentId?.trim() ?? "";
    if (!/^\d+$/.test(pid) && row.paymentOrderId) {
      const po = await prisma.dnxProviderOrder.findFirst({
        where: { paymentOrderId: row.paymentOrderId },
        select: { providerOrderId: true, rawResponseSanitized: true },
      });
      const rawPid =
        po?.rawResponseSanitized &&
        typeof po.rawResponseSanitized === "object" &&
        typeof (po.rawResponseSanitized as { providerPaymentId?: unknown }).providerPaymentId ===
          "string"
          ? String((po.rawResponseSanitized as { providerPaymentId: string }).providerPaymentId)
          : "";
      if (/^\d+$/.test(rawPid)) pid = rawPid;
      else if (po?.providerOrderId && /^\d+$/.test(po.providerOrderId)) {
        pid = po.providerOrderId;
      }
    }
    if (paymentId && /^\d+$/.test(paymentId)) pid = paymentId;
    if (!/^\d+$/.test(pid)) continue;

    peeked += 1;
    let remote: Awaited<ReturnType<NonNullable<typeof peek>>> | null = null;
    try {
      remote = await peek(pid);
    } catch (err) {
      errors.push({
        registrationId: row.id,
        providerPaymentId: pid,
        error: err instanceof Error ? err.message.slice(0, 120) : "provider_fetch_failed",
      });
      continue;
    }
    if (!remote) {
      errors.push({
        registrationId: row.id,
        providerPaymentId: pid,
        error: "payment_not_found",
      });
      continue;
    }

    const base = {
      registrationId: row.id,
      paymentOrderId: row.paymentOrderId,
      providerPaymentId: pid,
      localRegistrationStatus: row.status,
      localPaymentStatus: row.paymentStatus,
      remoteStatus: remote.status,
    };

    if (remote.status === "APPROVED" && row.paymentStatus === "EXPIRED") {
      findings.push({
        ...base,
        code: "REMOTE_APPROVED_LOCAL_EXPIRED",
        detail: "MP APPROVED vs local EXPIRED",
      });
    }
    if (
      (remote.status === "REFUNDED" || remote.status === "PARTIALLY_REFUNDED") &&
      row.paymentStatus === "APPROVED"
    ) {
      findings.push({
        ...base,
        code: "REMOTE_REFUNDED_LOCAL_APPROVED",
        detail: `MP ${remote.status} vs local APPROVED`,
      });
    }
    if (
      remote.status === "PARTIALLY_REFUNDED" &&
      row.paymentStatus !== "PARTIALLY_REFUNDED" &&
      row.paymentStatus !== "REFUNDED"
    ) {
      findings.push({
        ...base,
        code: "REMOTE_PARTIAL_REFUND_LOCAL_INCONSISTENT",
        detail: `MP PARTIALLY_REFUNDED vs local ${row.paymentStatus}`,
      });
    }
  }

  return {
    scanned: rows.length,
    peeked,
    findings,
    errors,
    wrote: false,
    createdRefund: false,
  };
}
