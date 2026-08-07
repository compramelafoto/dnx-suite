"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PartnersDomainError } from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { toPartnerActor } from "@/lib/admin/partners/runtime";
import {
  markPartnerBenefitSyncEventDiscarded,
  processPartnerBenefitSyncEvent,
  retryPartnerBenefitSyncEvent,
} from "./process";
import {
  isPartnerBenefitAutoSyncWritesEnabled,
} from "./flags";

function syncPath() {
  return `${adminRoutes.sponsors}/sincronizacion`;
}

export async function processSyncEventFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const eventId = formData.get("eventId")?.toString() ?? "";
  const forceApply = formData.get("forceApply")?.toString() === "1";
  try {
    const mode =
      forceApply || isPartnerBenefitAutoSyncWritesEnabled() ? "apply" : "shadow";
    const result = await processPartnerBenefitSyncEvent({
      eventId,
      actor,
      mode,
    });
    if (!result.ok) {
      redirect(
        `${syncPath()}?error=${encodeURIComponent(result.error ?? "process_failed")}`,
      );
    }
    revalidatePath(syncPath());
    redirect(
      `${syncPath()}?ok=processed&mode=${result.mode}&benefits=${result.benefitIds.length}`,
    );
  } catch (err) {
    if (err instanceof PartnersDomainError) {
      redirect(`${syncPath()}?error=${encodeURIComponent(err.message)}`);
    }
    throw err;
  }
}

export async function retrySyncEventFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const eventId = formData.get("eventId")?.toString() ?? "";
  try {
    await retryPartnerBenefitSyncEvent({ actor, eventId });
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo reintentar.";
    redirect(`${syncPath()}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(syncPath());
  redirect(`${syncPath()}?ok=retried`);
}

export async function discardSyncEventFormAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const actor = toPartnerActor(user);
  const eventId = formData.get("eventId")?.toString() ?? "";
  const reason = formData.get("reason")?.toString() ?? "manual";
  try {
    await markPartnerBenefitSyncEventDiscarded({ actor, eventId, reason });
  } catch (err) {
    const message =
      err instanceof PartnersDomainError ? err.message : "No se pudo descartar.";
    redirect(`${syncPath()}?error=${encodeURIComponent(message)}`);
  }
  revalidatePath(syncPath());
  redirect(`${syncPath()}?ok=discarded`);
}
