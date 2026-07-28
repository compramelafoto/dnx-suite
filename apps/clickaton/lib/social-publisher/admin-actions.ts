"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import { Prisma, prisma } from "@/lib/admin/db";
import { logSocialRequest } from "./prisma-store";

function revalidate(requestId?: string) {
  revalidatePath("/admin/social");
  revalidatePath("/admin/inscripciones");
  if (requestId) revalidatePath(`/admin/social?requestId=${requestId}`);
}

export async function approveSocialPublishAction(requestId: string) {
  const actor = await requireClickatonAdmin();
  const request = await prisma.dnxSocialPublishRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (!["PENDING_APPROVAL", "DRAFT"].includes(request.status)) return;
  const status = request.scheduleAt && request.scheduleAt > new Date() ? "SCHEDULED" : "APPROVED";
  await prisma.dnxSocialPublishRequest.update({
    where: { id: requestId },
    data: { status, approvedAt: new Date(), approvedByUserId: actor.id, rejectedAt: null, rejectionReason: null },
  });
  await logSocialRequest(requestId, "APPROVED", actor.id, { status });
  revalidate(requestId);
}

export async function rejectSocialPublishAction(requestId: string, formData: FormData) {
  const actor = await requireClickatonAdmin();
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 200);
  await prisma.dnxSocialPublishRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", rejectedAt: new Date(), rejectedByUserId: actor.id, rejectionReason: reason || null },
  });
  await logSocialRequest(requestId, "REJECTED", actor.id);
  revalidate(requestId);
}

export async function scheduleSocialPublishAction(requestId: string, formData: FormData) {
  const actor = await requireClickatonAdmin();
  const scheduleAt = new Date(String(formData.get("scheduleAt") ?? ""));
  if (Number.isNaN(scheduleAt.getTime())) throw new Error("Fecha de publicación inválida.");
  const request = await prisma.dnxSocialPublishRequest.findUniqueOrThrow({ where: { id: requestId } });
  const approved = ["APPROVED", "SCHEDULED"].includes(request.status);
  await prisma.dnxSocialPublishRequest.update({
    where: { id: requestId },
    data: { scheduleAt, timezone: String(formData.get("timezone") ?? "America/Argentina/Buenos_Aires"), status: approved ? "SCHEDULED" : request.status },
  });
  await logSocialRequest(requestId, "SCHEDULED", actor.id, { scheduleAt: scheduleAt.toISOString() });
  revalidate(requestId);
}

export async function cancelSocialPublishAction(requestId: string) {
  const actor = await requireClickatonAdmin();
  const request = await prisma.dnxSocialPublishRequest.findUniqueOrThrow({ where: { id: requestId } });
  if (request.status === "PUBLISHED") return;
  await prisma.dnxSocialPublishRequest.update({ where: { id: requestId }, data: { status: "CANCELLED" } });
  await logSocialRequest(requestId, "CANCELLED", actor.id);
  revalidate(requestId);
}

export async function retrySocialPublishAction(requestId: string) {
  const actor = await requireClickatonAdmin();
  await prisma.dnxSocialPublishRequest.update({
    where: { id: requestId },
    data: { status: "APPROVED", scheduleAt: null, nextRetryAt: new Date(), lastErrorCode: null, lastErrorMessage: null },
  });
  await logSocialRequest(requestId, "RETRY_REQUESTED", actor.id);
  revalidate(requestId);
}

export async function duplicateSocialPublishAction(requestId: string) {
  const actor = await requireClickatonAdmin();
  const source = await prisma.dnxSocialPublishRequest.findUniqueOrThrow({ where: { id: requestId } });
  const duplicate = await prisma.dnxSocialPublishRequest.create({
    data: {
      application: source.application, entityType: source.entityType, entityId: source.entityId,
      templateRef: source.templateRef, caption: source.caption, hashtags: source.hashtags, mentions: source.mentions,
      assets: source.assets === null ? Prisma.JsonNull : source.assets, socialAccountId: source.socialAccountId, platform: source.platform,
      status: "PENDING_APPROVAL", approvalRequired: true, priority: source.priority,
      metadata: { ...(source.metadata as object ?? {}), duplicatedFrom: source.id } as Prisma.InputJsonValue,
      idempotencyKey: `dup:${source.id}:${randomUUID()}`, createdByUserId: actor.id,
    },
  });
  await logSocialRequest(duplicate.id, "DUPLICATED", actor.id, { sourceRequestId: source.id });
  revalidate(duplicate.id);
}
