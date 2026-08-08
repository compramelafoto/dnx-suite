import { prisma } from "@repo/db";
import { createApplyPaymentEventUseCase } from "@/lib/checkout/application/apply-payment-event";
import { createCheckoutRegistrationPort } from "@/lib/checkout/domain/checkout-registration-port";
import { classifyLateApprovalRecovery } from "@/lib/checkout/domain/payment-precedence";
import type { DnxNormalizedPaymentStatus } from "@/lib/checkout/domain/types";
import { createCheckoutLogSink } from "@/lib/checkout/domain/observability";
import { createPrismaCheckoutMutations } from "@/lib/checkout/infrastructure/prisma-checkout-mutations";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { getDurablePaymentsClientForOps } from "@/lib/checkout/refunds/ops-payments-client";

export type ReconcileApprovedPlan = {
  registrationId: string | null;
  paymentOrderId: string | null;
  providerPaymentId: string;
  previous: {
    registrationStatus: string | null;
    paymentStatus: string | null;
    orderStatus: string | null;
    cancelledAt: string | null;
    credentialStatus: string | null;
  };
  detected: {
    status: string;
    amountMinor: number;
    refundedAmountMinor: number;
    liveMode: boolean | null;
    externalReference: string | null;
  } | null;
  recovery: string | null;
  changes: string[];
  applied: boolean;
  dryRun: boolean;
  error?: string;
};

function plannedChanges(input: {
  previous: ReconcileApprovedPlan["previous"];
  recovery: string | null;
}): string[] {
  if (input.recovery === "revive_auto_expiration") {
    return [
      `registrationStatus: ${input.previous.registrationStatus ?? "∅"} → CONFIRMED`,
      `paymentStatus: ${input.previous.paymentStatus ?? "∅"} → APPROVED`,
      "clear cancelledAt",
      "ensure capacity/accreditation path via confirmPaid",
    ];
  }
  if (input.recovery === "blocked_refunded") {
    return ["blocked: registration/payment already refunded — do not revive"];
  }
  if (input.recovery === "blocked_manual_cancel") {
    return ["blocked: manual CANCELLED — route to MANUAL_REVIEW, no silent revive"];
  }
  if (input.recovery === "blocked_terminal") {
    return ["blocked: terminal registration status"];
  }
  if (
    input.previous.registrationStatus === "CONFIRMED" &&
    input.previous.paymentStatus === "APPROVED"
  ) {
    return ["already_in_sync"];
  }
  return ["no_auto_recovery_plan"];
}

/**
 * Reconciliación de APPROVED tardío (post EXPIRED/CANCELLED automático).
 * dry-run: cero escrituras. apply: una inscripción por invocación.
 */
export async function reconcileApprovedFromProviderPayment(input: {
  providerPaymentId: string;
  dryRun: boolean;
}): Promise<ReconcileApprovedPlan> {
  const dryRun = input.dryRun !== false;
  const providerPaymentId = input.providerPaymentId.trim();
  if (!/^\d+$/.test(providerPaymentId)) {
    return {
      registrationId: null,
      paymentOrderId: null,
      providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        cancelledAt: null,
        credentialStatus: null,
      },
      detected: null,
      recovery: null,
      changes: [],
      applied: false,
      dryRun,
      error: "invalid_provider_payment_id",
    };
  }

  const ops = await getDurablePaymentsClientForOps();
  if (!ops.ok) {
    return {
      registrationId: null,
      paymentOrderId: null,
      providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        cancelledAt: null,
        credentialStatus: null,
      },
      detected: null,
      recovery: null,
      changes: [],
      applied: false,
      dryRun,
      error: ops.error,
    };
  }

  const svc = ops.client.service;
  if (!svc.peekProviderPayment) {
    return {
      registrationId: null,
      paymentOrderId: null,
      providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        cancelledAt: null,
        credentialStatus: null,
      },
      detected: null,
      recovery: null,
      changes: [],
      applied: false,
      dryRun,
      error: "peek_provider_payment_unavailable",
    };
  }

  let payment;
  try {
    payment = await svc.peekProviderPayment(providerPaymentId);
  } catch {
    return {
      registrationId: null,
      paymentOrderId: null,
      providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        cancelledAt: null,
        credentialStatus: null,
      },
      detected: null,
      recovery: null,
      changes: [],
      applied: false,
      dryRun,
      error: "provider_fetch_failed",
    };
  }

  if (!payment) {
    return {
      registrationId: null,
      paymentOrderId: null,
      providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        cancelledAt: null,
        credentialStatus: null,
      },
      detected: null,
      recovery: null,
      changes: [],
      applied: false,
      dryRun,
      error: "payment_not_found",
    };
  }

  let registrationId: string | null = null;
  let paymentOrderId: string | null = null;

  const byPid = await prisma.clickatonRegistration.findFirst({
    where: { providerPaymentId },
    select: { id: true, paymentOrderId: true },
  });
  if (byPid) {
    registrationId = byPid.id;
    paymentOrderId = byPid.paymentOrderId;
  }

  if (!registrationId && payment.externalReference) {
    const byRef = await prisma.clickatonRegistration.findFirst({
      where: { paymentExternalReference: payment.externalReference },
      select: { id: true, paymentOrderId: true },
    });
    if (byRef) {
      registrationId = byRef.id;
      paymentOrderId = byRef.paymentOrderId;
    }
  }

  if (!registrationId) {
    const po = await prisma.dnxProviderOrder.findFirst({
      where: {
        OR: [
          { providerOrderId: providerPaymentId },
          {
            rawResponseSanitized: {
              path: ["providerPaymentId"],
              equals: providerPaymentId,
            },
          },
        ],
      },
      select: { paymentOrderId: true },
    });
    if (po?.paymentOrderId) {
      paymentOrderId = po.paymentOrderId;
      const reg = await prisma.clickatonRegistration.findFirst({
        where: { paymentOrderId: po.paymentOrderId },
        select: { id: true },
      });
      registrationId = reg?.id ?? null;
    }
  }

  const previous = {
    registrationStatus: null as string | null,
    paymentStatus: null as string | null,
    orderStatus: null as string | null,
    cancelledAt: null as string | null,
    credentialStatus: null as string | null,
  };

  let holdExpired = false;
  if (registrationId) {
    const reg = await prisma.clickatonRegistration.findUnique({
      where: { id: registrationId },
      select: {
        status: true,
        paymentStatus: true,
        paymentOrderId: true,
        cancelledAt: true,
        holdExpiresAt: true,
        credential: { select: { status: true } },
      },
    });
    if (!reg) {
      return {
        registrationId,
        paymentOrderId,
        providerPaymentId,
        previous,
        detected: null,
        recovery: null,
        changes: [],
        applied: false,
        dryRun,
        error: "registration_not_found",
      };
    }
    previous.registrationStatus = reg.status;
    previous.paymentStatus = reg.paymentStatus;
    previous.cancelledAt = reg.cancelledAt?.toISOString() ?? null;
    previous.credentialStatus = reg.credential?.status ?? null;
    paymentOrderId = reg.paymentOrderId;
    holdExpired =
      reg.holdExpiresAt != null &&
      reg.holdExpiresAt.getTime() < Date.now() &&
      reg.status !== "CONFIRMED";
    if (reg.paymentOrderId) {
      const order = await svc.getOrder(reg.paymentOrderId);
      previous.orderStatus = order?.status ?? null;
    }
  }

  const detected = {
    status: payment.status,
    amountMinor: payment.amountMinor,
    refundedAmountMinor: payment.refundedAmountMinor ?? 0,
    liveMode: payment.liveMode ?? null,
    externalReference: payment.externalReference ?? null,
  };

  const recovery =
    registrationId && detected.status === "APPROVED"
      ? classifyLateApprovalRecovery({
          registrationStatus: previous.registrationStatus ?? "",
          paymentStatus: previous.paymentStatus ?? "",
          orderStatus: detected.status,
          capacityHoldActive: false,
          holdExpired,
        })
      : null;

  const changes = plannedChanges({ previous, recovery });

  if (!registrationId) {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId,
      previous,
      detected,
      recovery,
      changes,
      applied: false,
      dryRun,
      error: "local_registration_not_found",
    };
  }

  if (detected.status !== "APPROVED") {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId,
      previous,
      detected,
      recovery,
      changes: ["remote_not_approved"],
      applied: false,
      dryRun,
      error: "remote_not_approved",
    };
  }

  if (changes.length === 1 && changes[0] === "already_in_sync") {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId,
      previous,
      detected,
      recovery,
      changes,
      applied: false,
      dryRun,
    };
  }

  if (dryRun) {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId,
      previous,
      detected,
      recovery,
      changes,
      applied: false,
      dryRun: true,
    };
  }

  if (recovery !== "revive_auto_expiration") {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId,
      previous,
      detected,
      recovery,
      changes,
      applied: false,
      dryRun: false,
      error: "apply_blocked_recovery_not_revive",
    };
  }

  // APPLY — una sola inscripción, vía notification S2S + efectos Clickatón.
  const eventId = `recon_approved_${providerPaymentId}`;
  const apply = await svc.applyProviderPaymentNotification({
    providerPaymentId,
    eventId,
    action: "payment.updated",
    liveModeReported: payment.liveMode,
  });

  if (apply.outcome === "not_found" || !apply.order) {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId,
      previous,
      detected,
      recovery,
      changes,
      applied: false,
      dryRun: false,
      error: "order_not_found_for_payment",
    };
  }

  const order = apply.order;
  registrationId = registrationId ?? order.sourceId;

  const applyEffects = createApplyPaymentEventUseCase({
    payments: ops.client,
    registrationPort: createCheckoutRegistrationPort({
      publicRepo: createPrismaPublicRegistrationRepository(),
      mutations: createPrismaCheckoutMutations(),
    }),
    log: createCheckoutLogSink(),
  });

  const effect = await applyEffects.execute({
    eventId,
    orderId: order.id,
    status: order.status as DnxNormalizedPaymentStatus,
    amountMinor: order.amountMinor,
    currency: "ARS",
    provider: order.provider,
    externalReference: order.externalReference,
    sourceId: order.sourceId,
    receivedAt: new Date(),
    refundedAmountMinor: order.refundedAmountMinor ?? detected.refundedAmountMinor,
    netAmountMinor: order.netAmountMinor ?? detected.amountMinor,
    providerPaymentId: order.providerPaymentId ?? providerPaymentId,
    providerRefundIds: order.providerRefundIds ?? [],
    statusDetail: order.statusDetail ?? payment.statusDetail ?? null,
  });

  return {
    registrationId: effect.registrationId,
    paymentOrderId: order.id,
    providerPaymentId,
    previous,
    detected: {
      ...detected,
      status: order.status,
    },
    recovery,
    changes: effect.applied
      ? [
          ...changes,
          `applied registration=${effect.registrationStatus} payment=${effect.paymentStatus}`,
        ]
      : effect.duplicate
        ? [...changes, "duplicate_noop"]
        : [...changes, effect.conflict ? `conflict:${effect.conflictCode}` : "not_applied"],
    applied: effect.applied,
    dryRun: false,
  };
}
