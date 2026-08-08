"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PartnersDomainError } from "@repo/partners";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  cancelClickatonPrizeAssignment,
  confirmClickatonPrizeWinner,
  ensureEditionPrizeBundles,
  markClickatonPrizeDelivered,
  markPrizeBundleAvailable,
  replaceClickatonPrizeWinner,
  revokeClickatonPrizeWinner,
} from "./service";

function premiosPath(editionId: string, flash: string) {
  return `${adminRoutes.editions}/${editionId}/premios?flash=${encodeURIComponent(flash)}`;
}

function premiosErrorPath(editionId: string, message: string) {
  return `${adminRoutes.editions}/${editionId}/premios?error=${encodeURIComponent(message)}`;
}

function revalidatePremios(editionId: string) {
  revalidatePath(`${adminRoutes.editions}/${editionId}`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/premios`);
  revalidatePath(`${adminRoutes.sponsors}/sincronizacion`);
}

function formStr(formData: FormData, key: string): string {
  return formData.get(key)?.toString()?.trim() ?? "";
}

export async function ensureEditionPrizeBundlesAction(formData: FormData): Promise<void> {
  await requireClickatonAdmin();
  const editionId = formStr(formData, "editionId");
  const countRaw = formStr(formData, "count");
  const count = countRaw ? Number.parseInt(countRaw, 10) : undefined;
  try {
    const result = await ensureEditionPrizeBundles({
      editionId,
      count: Number.isFinite(count) ? count : undefined,
    });
    if (!result.ok) {
      redirect(premiosErrorPath(editionId, result.message));
    }
  } catch (e) {
    const message =
      e instanceof PartnersDomainError ? e.message : "No se pudieron crear los bundles.";
    redirect(premiosErrorPath(editionId, message));
  }
  revalidatePremios(editionId);
  redirect(premiosPath(editionId, "bundles_ensured"));
}

export async function markPrizeBundleAvailableAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const editionId = formStr(formData, "editionId");
  const bundleId = formStr(formData, "bundleId");
  try {
    const result = await markPrizeBundleAvailable({
      editionId,
      bundleId,
      actorUserId: user.id,
    });
    if (!result.ok) {
      redirect(premiosErrorPath(editionId, result.message));
    }
  } catch (e) {
    const message =
      e instanceof PartnersDomainError ? e.message : "No se pudo marcar disponible.";
    redirect(premiosErrorPath(editionId, message));
  }
  revalidatePremios(editionId);
  redirect(premiosPath(editionId, "bundle_available"));
}

export async function confirmPrizeWinnerAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const editionId = formStr(formData, "editionId");
  const bundleId = formStr(formData, "bundleId");
  const winnerRegistrationId = formStr(formData, "winnerRegistrationId");
  const winnerEntryId = formStr(formData, "winnerEntryId") || null;
  const promptId = formStr(formData, "promptId") || null;
  const note = formStr(formData, "note") || null;
  try {
    const result = await confirmClickatonPrizeWinner({
      editionId,
      bundleId,
      winnerRegistrationId,
      winnerEntryId,
      promptId,
      actorUserId: user.id,
      note,
    });
    if (!result.ok) {
      redirect(premiosErrorPath(editionId, result.message));
    }
  } catch (e) {
    const message =
      e instanceof PartnersDomainError ? e.message : "No se pudo confirmar el ganador.";
    redirect(premiosErrorPath(editionId, message));
  }
  revalidatePremios(editionId);
  redirect(premiosPath(editionId, "winner_confirmed"));
}

export async function revokePrizeWinnerAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const editionId = formStr(formData, "editionId");
  const bundleId = formStr(formData, "bundleId");
  const note = formStr(formData, "note") || null;
  try {
    const result = await revokeClickatonPrizeWinner({
      editionId,
      bundleId,
      actorUserId: user.id,
      note,
    });
    if (!result.ok) {
      redirect(premiosErrorPath(editionId, result.message));
    }
  } catch (e) {
    const message =
      e instanceof PartnersDomainError ? e.message : "No se pudo revocar el ganador.";
    redirect(premiosErrorPath(editionId, message));
  }
  revalidatePremios(editionId);
  redirect(premiosPath(editionId, "winner_revoked"));
}

export async function replacePrizeWinnerAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const editionId = formStr(formData, "editionId");
  const bundleId = formStr(formData, "bundleId");
  const newWinnerRegistrationId = formStr(formData, "newWinnerRegistrationId");
  const winnerEntryId = formStr(formData, "winnerEntryId") || null;
  const promptId = formStr(formData, "promptId") || null;
  const note = formStr(formData, "note") || null;
  try {
    const result = await replaceClickatonPrizeWinner({
      editionId,
      bundleId,
      newWinnerRegistrationId,
      winnerEntryId,
      promptId,
      actorUserId: user.id,
      note,
    });
    if (!result.ok) {
      redirect(premiosErrorPath(editionId, result.message));
    }
  } catch (e) {
    const message =
      e instanceof PartnersDomainError ? e.message : "No se pudo reemplazar el ganador.";
    redirect(premiosErrorPath(editionId, message));
  }
  revalidatePremios(editionId);
  redirect(premiosPath(editionId, "winner_replaced"));
}

export async function cancelPrizeAssignmentAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const editionId = formStr(formData, "editionId");
  const bundleId = formStr(formData, "bundleId");
  const note = formStr(formData, "note") || null;
  try {
    const result = await cancelClickatonPrizeAssignment({
      editionId,
      bundleId,
      actorUserId: user.id,
      note,
    });
    if (!result.ok) {
      redirect(premiosErrorPath(editionId, result.message));
    }
  } catch (e) {
    const message =
      e instanceof PartnersDomainError ? e.message : "No se pudo cancelar la asignación.";
    redirect(premiosErrorPath(editionId, message));
  }
  revalidatePremios(editionId);
  redirect(premiosPath(editionId, "assignment_cancelled"));
}

export async function markPrizeDeliveredAction(formData: FormData): Promise<void> {
  const user = await requireClickatonAdmin();
  const editionId = formStr(formData, "editionId");
  const bundleId = formStr(formData, "bundleId");
  const note = formStr(formData, "note") || null;
  try {
    const result = await markClickatonPrizeDelivered({
      editionId,
      bundleId,
      actorUserId: user.id,
      note,
    });
    if (!result.ok) {
      redirect(premiosErrorPath(editionId, result.message));
    }
  } catch (e) {
    const message =
      e instanceof PartnersDomainError ? e.message : "No se pudo marcar como entregado.";
    redirect(premiosErrorPath(editionId, message));
  }
  revalidatePremios(editionId);
  redirect(premiosPath(editionId, "prize_delivered"));
}
