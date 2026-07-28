"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { EditionFinanceError } from "../domain/errors";
import {
  activateEditionDistribution,
  createEditionDraftDistribution,
  evaluateEditionFinanceGate,
  listEditionDistributions,
  listEditionFinanceAudits,
  resolveActiveEditionDistribution,
} from "../infrastructure/prisma-edition-finance";
import { loadFinanceActor } from "../infrastructure/load-finance-actor";
import { canManageEditionFinancialDistribution } from "../permissions";

function financePath(editionId: string) {
  return `${adminRoutes.editions}/${editionId}/finanzas`;
}

export async function getEditionFinancePageData(editionId: string) {
  const user = await requireClickatonAdmin();
  const actor = await loadFinanceActor(user.id);
  const canManage = canManageEditionFinancialDistribution(actor, editionId);

  const [distributions, active, audits, gate] = await Promise.all([
    listEditionDistributions(actor, editionId),
    resolveActiveEditionDistribution(editionId),
    listEditionFinanceAudits(editionId),
    evaluateEditionFinanceGate({
      editionId,
      mode: process.env.NODE_ENV === "production" ? "LIVE" : "TEST",
      dnxPaymentsReady:
        process.env.DNX_CLICKATON_DNX_PAYMENTS_CHECKOUT_ENABLED === "true",
      webhookConfigured: Boolean(
        process.env.CLICKATON_DNX_PAYMENTS_WEBHOOK_SECRET ||
          process.env.DNX_PAYMENTS_WEBHOOK_SECRET,
      ),
      hasActivePricePhase: true,
    }),
  ]);

  const checkoutProvider = (
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual"
  ).toLowerCase();
  const activeAlloc = active?.allocations[0] ?? null;
  const readiness = {
    distributionStatus: active ? ("ACTIVE" as const) : ("DRAFT_OR_NONE" as const),
    sumOk: active
      ? active.allocations.reduce((s, a) => s + a.shareBps, 0) === 10_000
      : false,
    beneficiaryLabel: activeAlloc?.beneficiaryDisplayName ?? "—",
    paymentAccountConnected: Boolean(
      activeAlloc?.paymentConnectionId &&
        activeAlloc.paymentConnection?.status === "ACTIVE",
    ),
    oauthLikelyValid: Boolean(
      activeAlloc?.paymentConnection?.canReceivePayments &&
        activeAlloc.paymentConnection.status === "ACTIVE",
    ),
    accountMode: activeAlloc?.paymentConnection?.environment ?? "—",
    checkoutAllocationsReady: Boolean(
      active &&
        active.allocations.every((a) => a.paymentConnectionId) &&
        active.allocations.reduce((s, a) => s + a.shareBps, 0) === 10_000,
    ),
    webhookReady: Boolean(
      process.env.CLICKATON_DNX_PAYMENTS_WEBHOOK_SECRET ||
        process.env.DNX_PAYMENTS_WEBHOOK_SECRET,
    ),
    refundsBlocked: true,
    ledgerCompletePending: true,
    checkoutProvider,
    lastError: activeAlloc?.paymentConnection?.lastError ?? null,
  };

  return {
    canManage,
    canView: true,
    distributions,
    active,
    audits,
    gate,
    readiness,
    actorUserId: actor.userId,
  };
}

/** Validación segura (sin cobro): reutiliza gate + readiness. */
export async function validateEditionFinanceConfigAction(editionId: string) {
  const data = await getEditionFinancePageData(editionId);
  return {
    ok: data.gate.ok && data.readiness.checkoutAllocationsReady,
    gate: data.gate,
    readiness: data.readiness,
  };
}

export async function validateEditionFinanceConfigFormAction(
  editionId: string,
): Promise<void> {
  await validateEditionFinanceConfigAction(editionId);
  revalidatePath(financePath(editionId));
}

export async function dryRunEditionCheckoutPlanFormAction(
  editionId: string,
): Promise<void> {
  await dryRunEditionCheckoutPlanAction(editionId);
  revalidatePath(financePath(editionId));
}

/**
 * Dry-run de checkout TEST: planifica allocations desde snapshot ACTIVE.
 * No crea preferencia MP ni cobra dinero.
 */
export async function dryRunEditionCheckoutPlanAction(editionId: string) {
  await requireClickatonAdmin();
  const active = await resolveActiveEditionDistribution(editionId);
  if (!active) {
    return { ok: false as const, reason: "NO_ACTIVE_DISTRIBUTION" };
  }
  const { buildOrderFinanceSnapshot, toEditionCheckoutFinanceSnapshot } = await import(
    "../domain/snapshot"
  );
  const { planEditionCheckoutFromSnapshot } = await import("@repo/payments/edition-checkout");
  try {
    const snap = buildOrderFinanceSnapshot({
      distribution: active,
      currency: "ARS",
      grossAmount: 2_500_000,
      discountAmount: 0,
      providerFee: 0,
      platformFee: 0,
    });
    const planned = planEditionCheckoutFromSnapshot(
      toEditionCheckoutFinanceSnapshot(snap),
      { bridgeMode: "manual" },
    );
    return {
      ok: true as const,
      modality: planned.modality,
      collectorPaymentAccountId: planned.collectorPaymentAccountId,
      allocations: planned.allocations.map((a) => ({
        beneficiaryUserId: a.beneficiaryUserId,
        paymentAccountId: a.paymentAccountId,
        basisPoints: a.basisPoints,
        allocationAmountEstimated: a.allocationAmountEstimated,
        // sin tokens
      })),
    };
  } catch (err) {
    return {
      ok: false as const,
      reason: err instanceof Error ? err.message.slice(0, 160) : "dry_run_failed",
    };
  }
}

export async function activateEditionDistributionFormAction(
  editionId: string,
  formData: FormData,
): Promise<void> {
  const versionId = String(formData.get("versionId") ?? "");
  const user = await requireClickatonAdmin();
  const actor = await loadFinanceActor(user.id);
  await activateEditionDistribution(actor, { editionId, versionId });
  revalidatePath(financePath(editionId));
}

export async function createTammyDraftFormAction(
  editionId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = await loadFinanceActor(user.id);
  const financialIdentityId = String(formData.get("financialIdentityId") ?? "");
  const paymentConnectionId = String(formData.get("paymentConnectionId") ?? "") || null;
  if (!financialIdentityId) {
    throw new EditionFinanceError("VALIDATION", "Falta identidad financiera.");
  }
  await createEditionDraftDistribution(actor, {
    editionId,
    name: "Distribución edición",
    allocations: [
      {
        financialIdentityId,
        paymentConnectionId,
        sharePercent: 100,
        role: "ORGANIZER",
      },
    ],
  });
  revalidatePath(financePath(editionId));
}
