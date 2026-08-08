import { prisma } from "@repo/db";

/**
 * Observabilidad financiera de reembolsos sobre allocations.
 * No borra ni reescribe asientos PAID; registra auditoría compensatoria idempotente.
 */
export async function observeRefundOnOrderAllocations(input: {
  paymentOrderId: string;
  registrationId: string;
  refundedAmountMinor: number;
  kind: "total" | "partial";
  requestId: string;
}): Promise<{ recorded: boolean; duplicate: boolean }> {
  const idempotencyKey = `refund_observe:${input.paymentOrderId}:${input.kind}:${input.refundedAmountMinor}`;

  const recent = await prisma.clickatonRegistrationAudit.findMany({
    where: {
      registrationId: input.registrationId,
      action: "PAYMENT_REFUND_ALLOCATION_OBSERVED",
    },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: { id: true, metadata: true },
  });

  const duplicate = recent.some((row) => {
    const meta = row.metadata as { idempotencyKey?: unknown } | null;
    return meta?.idempotencyKey === idempotencyKey;
  });
  if (duplicate) {
    return { recorded: false, duplicate: true };
  }

  await prisma.clickatonRegistrationAudit.create({
    data: {
      registrationId: input.registrationId,
      action: "PAYMENT_REFUND_ALLOCATION_OBSERVED",
      source: "dnx_payments_refund",
      metadata: {
        paymentOrderId: input.paymentOrderId,
        refundedAmountMinor: input.refundedAmountMinor,
        kind: input.kind,
        requestId: input.requestId,
        idempotencyKey,
        note: "compensating_observation_only_no_rewrite",
      },
    },
  });

  return { recorded: true, duplicate: false };
}
