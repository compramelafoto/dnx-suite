"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { isClickatonDnxCheckoutEnabled } from "@repo/payments/clickaton-checkout";
import { EditionFinanceError } from "../domain/errors";
import {
  activateEditionDistribution,
  createEditionDraftDistribution,
  evaluateEditionFinanceGate,
  listEditionDistributions,
  listEditionFinanceAudits,
  resolveActiveEditionDistribution,
  updateDraftAllocations,
} from "../infrastructure/prisma-edition-finance";
import { listActiveFinanceRecipientsForPicker } from "../infrastructure/list-active-recipients";
import { loadFinanceActor } from "../infrastructure/load-finance-actor";
import {
  canManageEditionFinancialDistribution,
  canMutateEditionFinancialDistribution,
} from "../permissions";
import type { AllocationDraftInput } from "../domain/validate-allocations";

function financePath(editionId: string) {
  return `${adminRoutes.editions}/${editionId}/finanzas`;
}

function financePathWithMsg(
  editionId: string,
  kind: "error" | "ok",
  message: string,
) {
  const q = new URLSearchParams({
    [kind === "error" ? "financeError" : "financeOk"]: message.slice(0, 280),
  });
  return `${financePath(editionId)}?${q.toString()}`;
}

export async function getEditionFinancePageData(editionId: string) {
  const user = await requireClickatonAdmin();
  const actor = await loadFinanceActor(user.id);
  const canManage = canManageEditionFinancialDistribution(actor, editionId);

  const [distributions, active, audits, gate, recipients] = await Promise.all([
    listEditionDistributions(actor, editionId),
    resolveActiveEditionDistribution(editionId),
    listEditionFinanceAudits(editionId),
    evaluateEditionFinanceGate({
      editionId,
      mode: process.env.NODE_ENV === "production" ? "LIVE" : "TEST",
      dnxPaymentsReady: isClickatonDnxCheckoutEnabled(process.env),
      webhookConfigured: Boolean(
        process.env.CLICKATON_DNX_PAYMENTS_WEBHOOK_SECRET ||
          process.env.DNX_PAYMENTS_WEBHOOK_SECRET,
      ),
      hasActivePricePhase: true,
    }),
    listActiveFinanceRecipientsForPicker(),
  ]);

  const checkoutProvider = (
    process.env.CLICKATON_DNX_PAYMENTS_PROVIDER ?? "manual"
  ).toLowerCase();
  const allocs = active?.allocations ?? [];
  const hasActiveAllocations = allocs.length > 0;
  const readiness = {
    distributionStatus: active ? ("ACTIVE" as const) : ("DRAFT_OR_NONE" as const),
    sumOk: active
      ? allocs.reduce((s, a) => s + a.shareBps, 0) === 10_000
      : false,
    beneficiaryLabel:
      allocs.length === 0
        ? "—"
        : allocs.map((a) => `${a.beneficiaryDisplayName} ${a.shareValue}%`).join(" · "),
    paymentAccountConnected:
      hasActiveAllocations &&
      allocs.every(
        (a) => a.paymentConnectionId && a.paymentConnection?.status === "ACTIVE",
      ),
    oauthLikelyValid:
      hasActiveAllocations &&
      allocs.every((a) => a.paymentConnection?.canReceivePayments),
    accountMode:
      [...new Set(allocs.map((a) => a.paymentConnection?.environment).filter(Boolean))].join(
        ",",
      ) || "—",
    checkoutAllocationsReady: Boolean(
      active &&
        hasActiveAllocations &&
        allocs.every((a) => a.paymentConnectionId) &&
        allocs.reduce((s, a) => s + a.shareBps, 0) === 10_000,
    ),
    webhookReady: Boolean(
      process.env.CLICKATON_DNX_PAYMENTS_WEBHOOK_SECRET ||
        process.env.DNX_PAYMENTS_WEBHOOK_SECRET,
    ),
    refundsBlocked: true,
    ledgerCompletePending: true,
    checkoutProvider,
    lastError:
      allocs.map((a) => a.paymentConnection?.lastError).find(Boolean) ?? null,
  };

  return {
    canManage,
    canMutate: canMutateEditionFinancialDistribution(actor),
    canView: true,
    distributions,
    active,
    audits,
    gate,
    readiness,
    recipients,
    actorUserId: actor.userId,
  };
}

function parseAllocationsJson(raw: string): AllocationDraftInput[] {
  const parsed = JSON.parse(raw) as AllocationDraftInput[];
  if (!Array.isArray(parsed)) {
    throw new EditionFinanceError("VALIDATION", "Allocations inválidas.");
  }
  return parsed.map((row) => ({
    financialIdentityId: String(row.financialIdentityId ?? ""),
    paymentConnectionId: row.paymentConnectionId
      ? String(row.paymentConnectionId)
      : null,
    sharePercent: Number(row.sharePercent),
    role: row.role ?? "ORGANIZER",
    sortOrder: row.sortOrder,
  }));
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
  try {
    const user = await requireClickatonAdmin();
    const actor = await loadFinanceActor(user.id);
    await activateEditionDistribution(actor, { editionId, versionId });
    revalidatePath(financePath(editionId));
    redirect(
      financePathWithMsg(
        editionId,
        "ok",
        "Distribución activada (ACTIVE). El gate comercial puede seguir bloqueado si falta checkout/webhook o MP del beneficiario.",
      ),
    );
  } catch (err) {
    // next/navigation redirect() throws; must rethrow
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const message =
      err instanceof EditionFinanceError
        ? err.message
        : "No se pudo activar la distribución.";
    redirect(financePathWithMsg(editionId, "error", message));
  }
}

export async function createEditionDraftFormAction(
  editionId: string,
  formData: FormData,
): Promise<void> {
  try {
    const user = await requireClickatonAdmin();
    const actor = await loadFinanceActor(user.id);
    const allocations = parseAllocationsJson(String(formData.get("allocationsJson") ?? "[]"));
    await createEditionDraftDistribution(actor, {
      editionId,
      name: String(formData.get("name") ?? "Distribución edición"),
      allocations,
    });
    revalidatePath(financePath(editionId));
    redirect(
      financePathWithMsg(
        editionId,
        "ok",
        "Versión DRAFT creada. Revisá conexiones ACTIVE antes de Activar.",
      ),
    );
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const message =
      err instanceof EditionFinanceError
        ? err.message
        : "No se pudo crear el DRAFT.";
    redirect(financePathWithMsg(editionId, "error", message));
  }
}

/** @deprecated alias — usar createEditionDraftFormAction */
export const createTammyDraftFormAction = createEditionDraftFormAction;

export async function updateDraftAllocationsFormAction(
  editionId: string,
  formData: FormData,
): Promise<void> {
  try {
    const user = await requireClickatonAdmin();
    const actor = await loadFinanceActor(user.id);
    const versionId = String(formData.get("versionId") ?? "");
    const allocations = parseAllocationsJson(String(formData.get("allocationsJson") ?? "[]"));
    if (!versionId) {
      redirect(financePathWithMsg(editionId, "error", "Falta versionId del DRAFT."));
    }
    await updateDraftAllocations(actor, { editionId, versionId, allocations });
    revalidatePath(financePath(editionId));
    redirect(financePathWithMsg(editionId, "ok", "DRAFT actualizado."));
  } catch (err) {
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw err;
    }
    const message =
      err instanceof EditionFinanceError
        ? err.message
        : "No se pudo actualizar el DRAFT.";
    redirect(financePathWithMsg(editionId, "error", message));
  }
}
