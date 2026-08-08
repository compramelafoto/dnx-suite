import { prisma } from "@repo/db";
import { createApplyPaymentEventUseCase } from "@/lib/checkout/application/apply-payment-event";
import { createCheckoutRegistrationPort } from "@/lib/checkout/domain/checkout-registration-port";
import { createPrismaCheckoutMutations } from "@/lib/checkout/infrastructure/prisma-checkout-mutations";
import { createPrismaPublicRegistrationRepository } from "@/lib/public-registration/infrastructure/prisma-public-registration-repository";
import { createCheckoutLogSink } from "@/lib/checkout/domain/observability";
import { getDurablePaymentsClientForOps } from "@/lib/checkout/refunds/ops-payments-client";
import type { DnxNormalizedPaymentStatus } from "@/lib/checkout/domain/types";

export type ReconcileRefundPlan = {
  registrationId: string | null;
  paymentOrderId: string | null;
  providerPaymentId: string;
  previous: {
    registrationStatus: string | null;
    paymentStatus: string | null;
    orderStatus: string | null;
    refundedAmountMinor: number | null;
  };
  detected: {
    status: string;
    amountMinor: number;
    refundedAmountMinor: number;
    netAmountMinor: number;
    kind: "none" | "partial" | "total";
    providerRefundIds: string[];
  } | null;
  changes: string[];
  applied: boolean;
  dryRun: boolean;
  error?: string;
};

async function resolveProviderPaymentId(input: {
  providerPaymentId?: string;
  registrationId?: string;
}): Promise<{
  providerPaymentId: string;
  registrationId: string | null;
  error?: string;
}> {
  let providerPaymentId = input.providerPaymentId?.trim() ?? "";
  let registrationId = input.registrationId?.trim() || null;

  if (providerPaymentId && !/^\d+$/.test(providerPaymentId)) {
    return { providerPaymentId: "", registrationId, error: "invalid_provider_payment_id" };
  }

  if (!providerPaymentId && registrationId) {
    const reg = await prisma.clickatonRegistration.findUnique({
      where: { id: registrationId },
      select: {
        providerPaymentId: true,
        paymentOrderId: true,
      },
    });
    if (!reg) {
      return { providerPaymentId: "", registrationId, error: "registration_not_found" };
    }
    if (reg.providerPaymentId && /^\d+$/.test(reg.providerPaymentId)) {
      providerPaymentId = reg.providerPaymentId;
    } else if (reg.paymentOrderId) {
      const po = await prisma.dnxProviderOrder.findFirst({
        where: { paymentOrderId: reg.paymentOrderId },
        select: { providerOrderId: true, rawResponseSanitized: true },
      });
      const rawPid =
        po?.rawResponseSanitized &&
        typeof po.rawResponseSanitized === "object" &&
        typeof (po.rawResponseSanitized as { providerPaymentId?: unknown }).providerPaymentId ===
          "string"
          ? String((po.rawResponseSanitized as { providerPaymentId: string }).providerPaymentId)
          : "";
      if (/^\d+$/.test(rawPid)) providerPaymentId = rawPid;
      else if (po?.providerOrderId && /^\d+$/.test(po.providerOrderId)) {
        providerPaymentId = po.providerOrderId;
      }
    }
  }

  if (!providerPaymentId) {
    return { providerPaymentId: "", registrationId, error: "provider_payment_id_required" };
  }
  return { providerPaymentId, registrationId };
}

function refundKind(status: string): "none" | "partial" | "total" {
  if (status === "REFUNDED") return "total";
  if (status === "PARTIALLY_REFUNDED") return "partial";
  return "none";
}

function plannedChanges(input: {
  previous: ReconcileRefundPlan["previous"];
  detectedStatus: string;
  detectedRefunded: number;
}): string[] {
  const changes: string[] = [];
  const payTarget =
    input.detectedStatus === "REFUNDED"
      ? "REFUNDED"
      : input.detectedStatus === "PARTIALLY_REFUNDED"
        ? "PARTIALLY_REFUNDED"
        : null;
  if (!payTarget) return ["no_refund_detected"];
  if (input.previous.paymentStatus !== payTarget) {
    changes.push(`paymentStatus: ${input.previous.paymentStatus ?? "∅"} → ${payTarget}`);
  }
  if (input.detectedStatus === "REFUNDED" && input.previous.registrationStatus !== "REFUNDED") {
    changes.push(
      `registrationStatus: ${input.previous.registrationStatus ?? "∅"} → REFUNDED`,
    );
  }
  if (input.previous.refundedAmountMinor !== input.detectedRefunded) {
    changes.push(
      `refundedAmountMinor: ${input.previous.refundedAmountMinor ?? "∅"} → ${input.detectedRefunded}`,
    );
  }
  if (input.previous.orderStatus !== input.detectedStatus) {
    changes.push(
      `orderStatus: ${input.previous.orderStatus ?? "∅"} → ${input.detectedStatus}`,
    );
  }
  return changes.length ? changes : ["already_in_sync"];
}

/**
 * Reconciliación histórica de un pago MP → inscripción.
 * dry-run: solo S2S + plan. apply: muta DNX + Clickatón.
 * Nunca crea devoluciones en Mercado Pago.
 */
export async function reconcileRefundFromProviderPayment(input: {
  providerPaymentId?: string;
  registrationId?: string;
  dryRun: boolean;
}): Promise<ReconcileRefundPlan> {
  const dryRun = input.dryRun !== false;
  const resolved = await resolveProviderPaymentId(input);
  if (resolved.error) {
    return {
      registrationId: resolved.registrationId,
      paymentOrderId: null,
      providerPaymentId: resolved.providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        refundedAmountMinor: null,
      },
      detected: null,
      changes: [],
      applied: false,
      dryRun,
      error: resolved.error,
    };
  }

  const ops = await getDurablePaymentsClientForOps();
  if (!ops.ok) {
    return {
      registrationId: resolved.registrationId,
      paymentOrderId: null,
      providerPaymentId: resolved.providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        refundedAmountMinor: null,
      },
      detected: null,
      changes: [],
      applied: false,
      dryRun,
      error: ops.error,
    };
  }

  const svc = ops.client.service;
  if (!svc.peekProviderPayment) {
    return {
      registrationId: resolved.registrationId,
      paymentOrderId: null,
      providerPaymentId: resolved.providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        refundedAmountMinor: null,
      },
      detected: null,
      changes: [],
      applied: false,
      dryRun,
      error: "peek_provider_payment_unavailable",
    };
  }

  let payment;
  try {
    payment = await svc.peekProviderPayment(resolved.providerPaymentId);
  } catch (err) {
    return {
      registrationId: resolved.registrationId,
      paymentOrderId: null,
      providerPaymentId: resolved.providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        refundedAmountMinor: null,
      },
      detected: null,
      changes: [],
      applied: false,
      dryRun,
      error:
        err instanceof Error && /tempor|timeout|5\d\d|ECONN/i.test(err.message)
          ? "provider_temporary_error"
          : "provider_fetch_failed",
    };
  }

  if (!payment) {
    return {
      registrationId: resolved.registrationId,
      paymentOrderId: null,
      providerPaymentId: resolved.providerPaymentId,
      previous: {
        registrationStatus: null,
        paymentStatus: null,
        orderStatus: null,
        refundedAmountMinor: null,
      },
      detected: null,
      changes: [],
      applied: false,
      dryRun,
      error: "payment_not_found",
    };
  }

  let registrationId = resolved.registrationId;
  let paymentOrderId: string | null = null;
  if (registrationId) {
    const reg = await prisma.clickatonRegistration.findUnique({
      where: { id: registrationId },
      select: { paymentOrderId: true },
    });
    paymentOrderId = reg?.paymentOrderId ?? null;
  }
  if (!paymentOrderId && payment.externalReference) {
    const byRef = await prisma.clickatonRegistration.findFirst({
      where: { paymentExternalReference: payment.externalReference },
      select: { id: true, paymentOrderId: true },
    });
    if (byRef) {
      registrationId = registrationId ?? byRef.id;
      paymentOrderId = byRef.paymentOrderId;
    }
  }

  const previous = {
    registrationStatus: null as string | null,
    paymentStatus: null as string | null,
    orderStatus: null as string | null,
    refundedAmountMinor: null as number | null,
  };

  if (registrationId) {
    const reg = await prisma.clickatonRegistration.findUnique({
      where: { id: registrationId },
      select: {
        status: true,
        paymentStatus: true,
        refundedAmountMinor: true,
        paymentOrderId: true,
      },
    });
    if (!reg) {
      return {
        registrationId,
        paymentOrderId,
        providerPaymentId: resolved.providerPaymentId,
        previous,
        detected: null,
        changes: [],
        applied: false,
        dryRun,
        error: "registration_not_found",
      };
    }
    previous.registrationStatus = reg.status;
    previous.paymentStatus = reg.paymentStatus;
    previous.refundedAmountMinor = reg.refundedAmountMinor;
    paymentOrderId = reg.paymentOrderId;
    if (reg.paymentOrderId) {
      const order = await svc.getOrder(reg.paymentOrderId);
      previous.orderStatus = order?.status ?? null;
    }
  }

  const detected = {
    status: payment.status,
    amountMinor: payment.amountMinor,
    refundedAmountMinor: payment.refundedAmountMinor ?? 0,
    netAmountMinor: payment.netAmountMinor ?? payment.amountMinor,
    kind: refundKind(payment.status),
    providerRefundIds: payment.providerRefundIds ?? [],
  };

  const changes = plannedChanges({
    previous,
    detectedStatus: detected.status,
    detectedRefunded: detected.refundedAmountMinor,
  });

  if (dryRun) {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId: resolved.providerPaymentId,
      previous,
      detected,
      changes,
      applied: false,
      dryRun: true,
    };
  }

  // APPLY
  const eventId = `recon_refund_${resolved.providerPaymentId}_${detected.refundedAmountMinor}`;
  const apply = await svc.applyProviderPaymentNotification({
    providerPaymentId: resolved.providerPaymentId,
    eventId,
    action: "payment.updated",
    liveModeReported: payment.liveMode,
  });

  if (apply.outcome === "not_found" || !apply.order) {
    return {
      registrationId,
      paymentOrderId,
      providerPaymentId: resolved.providerPaymentId,
      previous,
      detected,
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
    netAmountMinor: order.netAmountMinor ?? detected.netAmountMinor,
    providerPaymentId: order.providerPaymentId ?? resolved.providerPaymentId,
    providerRefundIds: order.providerRefundIds ?? detected.providerRefundIds,
    statusDetail: order.statusDetail ?? payment.statusDetail ?? null,
  });

  return {
    registrationId: effect.registrationId,
    paymentOrderId: order.id,
    providerPaymentId: resolved.providerPaymentId,
    previous,
    detected: {
      ...detected,
      status: order.status,
    },
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
