"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  getEditionFotoRankSyncStats,
  processDueFotoRankSyncs,
  processFotoRankSyncById,
  updateEditionFotoRankLink,
  validateFotoRankContestForEdition,
} from "../infrastructure/prisma-fotorank-sync";
import { prisma } from "@/lib/admin/db";

function editionPath(editionId: string) {
  return `${adminRoutes.editions}/${editionId}`;
}

export async function getEditionFotoRankAdminData(editionId: string) {
  await requireClickatonAdmin();
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: {
      fotorankContestId: true,
      fotoRankSyncEnabled: true,
      fotoRankSyncMode: true,
      fotoRankValidationStatus: true,
      fotoRankLastValidatedAt: true,
      fotoRankValidationError: true,
    },
  });
  const stats = await getEditionFotoRankSyncStats(editionId);
  const recent = await prisma.clickatonFotoRankSync.findMany({
    where: { editionId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: {
      id: true,
      registrationId: true,
      status: true,
      attemptCount: true,
      fotoRankParticipantId: true,
      lastErrorCode: true,
      lastErrorMessage: true,
      completedAt: true,
      updatedAt: true,
    },
  });
  return { edition, stats, recent };
}

export async function saveEditionFotoRankLinkFormAction(
  editionId: string,
  formData: FormData,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const contestId = String(formData.get("fotorankContestId") ?? "").trim() || null;
  const enabled = formData.get("fotoRankSyncEnabled") === "on";
  await updateEditionFotoRankLink({
    editionId,
    fotorankContestId: contestId,
    fotoRankSyncEnabled: enabled,
    actorUserId: user.id,
  });
  revalidatePath(editionPath(editionId));
}

export async function validateEditionFotoRankContestFormAction(
  editionId: string,
): Promise<void> {
  const user = await requireClickatonAdmin();
  const edition = await prisma.clickatonEdition.findUnique({
    where: { id: editionId },
    select: { fotorankContestId: true, fotoRankSyncEnabled: true },
  });
  if (!edition?.fotorankContestId) return;
  const v = await validateFotoRankContestForEdition(edition.fotorankContestId);
  await updateEditionFotoRankLink({
    editionId,
    fotorankContestId: edition.fotorankContestId,
    fotoRankSyncEnabled: edition.fotoRankSyncEnabled && v.status === "VALID",
    actorUserId: user.id,
  });
  revalidatePath(editionPath(editionId));
}

export async function retryFotoRankSyncFormAction(
  editionId: string,
  formData: FormData,
): Promise<void> {
  await requireClickatonAdmin();
  const syncId = String(formData.get("syncId") ?? "");
  if (!syncId) return;
  await prisma.clickatonFotoRankSync.update({
    where: { id: syncId },
    data: { status: "PENDING", nextRetryAt: new Date() },
  });
  await processFotoRankSyncById(syncId);
  revalidatePath(editionPath(editionId));
  revalidatePath(adminRoutes.registrations);
}

export async function retryAllPendingFotoRankSyncFormAction(
  editionId: string,
): Promise<void> {
  await requireClickatonAdmin();
  await prisma.clickatonFotoRankSync.updateMany({
    where: {
      editionId,
      status: { in: ["PENDING", "RETRY_PENDING", "FAILED"] },
    },
    data: { status: "PENDING", nextRetryAt: new Date() },
  });
  await processDueFotoRankSyncs(100);
  revalidatePath(editionPath(editionId));
}

export async function markFotoRankSyncManualReviewFormAction(
  editionId: string,
  formData: FormData,
): Promise<void> {
  await requireClickatonAdmin();
  const syncId = String(formData.get("syncId") ?? "");
  if (!syncId) return;
  await prisma.clickatonFotoRankSync.update({
    where: { id: syncId },
    data: { status: "MANUAL_REVIEW", nextRetryAt: null },
  });
  const sync = await prisma.clickatonFotoRankSync.findUnique({
    where: { id: syncId },
    select: { registrationId: true },
  });
  if (sync) {
    await prisma.clickatonRegistration.update({
      where: { id: sync.registrationId },
      data: { fotoRankSyncStatus: "MANUAL_REVIEW" },
    });
  }
  revalidatePath(editionPath(editionId));
}

/** Reintentar / sincronizar desde detalle de inscripción (admin). */
export async function syncRegistrationFotoRankFormAction(
  registrationId: string,
): Promise<void> {
  await requireClickatonAdmin();
  const reg = await prisma.clickatonRegistration.findUnique({
    where: { id: registrationId },
    select: {
      id: true,
      editionId: true,
      userId: true,
      paymentOrderId: true,
      status: true,
      paymentStatus: true,
      confirmedAt: true,
    },
  });
  if (!reg) return;
  if (reg.status !== "CONFIRMED" || reg.paymentStatus !== "APPROVED") return;

  const existing = await prisma.clickatonFotoRankSync.findFirst({
    where: { registrationId },
    orderBy: { updatedAt: "desc" },
  });
  if (existing) {
    await prisma.clickatonFotoRankSync.update({
      where: { id: existing.id },
      data: { status: "PENDING", nextRetryAt: new Date() },
    });
    await processFotoRankSyncById(existing.id);
  } else {
    const { enqueueFotoRankSyncAfterPaid } = await import(
      "../infrastructure/prisma-fotorank-sync"
    );
    const enq = await enqueueFotoRankSyncAfterPaid({
      registrationId: reg.id,
      editionId: reg.editionId,
      userId: reg.userId,
      paymentOrderId: reg.paymentOrderId,
      paidAt: reg.confirmedAt ?? new Date(),
    });
    if (enq.syncId) await processFotoRankSyncById(enq.syncId);
  }
  revalidatePath(`${adminRoutes.registrations}/${registrationId}`);
  revalidatePath(editionPath(reg.editionId));
}
