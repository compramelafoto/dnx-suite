"use server";

import { revalidatePath } from "next/cache";
import { adminRoutes } from "@/config/admin/navigation";
import { requireClickatonAdmin } from "@/lib/admin/auth";
import {
  admitSubmission,
  closeAdmissionBatch,
  ensureAdmissionConfig,
  evaluatePendingBulk,
  evaluateSubmission,
  freezeAdmittedEntries,
  getOrCreateDraftBatch,
  rejectSubmission,
  reopenAdmissionBatch,
  resolveManualReview,
} from "./service";

function actorFrom(user: { id: number; email: string; globalRole: string }) {
  return { id: user.id, email: user.email, globalRole: user.globalRole };
}

function revalidateAdmission(editionId: string) {
  revalidatePath(`${adminRoutes.editions}/${editionId}/admision`);
  revalidatePath(`${adminRoutes.editions}/${editionId}/envios`);
}

export async function ensureAdmissionConfigAction(editionId: string) {
  await requireClickatonAdmin();
  await ensureAdmissionConfig(editionId);
  revalidateAdmission(editionId);
}

export async function evaluateSubmissionAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await evaluateSubmission({
    editionId,
    submissionId: String(formData.get("submissionId") ?? ""),
    actor: actorFrom(user),
    uploadExceptionApproved: formData.get("uploadException") === "1",
    reason: String(formData.get("reason") ?? "") || null,
  });
  revalidateAdmission(editionId);
}

export async function admitSubmissionAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await admitSubmission({
    editionId,
    submissionId: String(formData.get("submissionId") ?? ""),
    actor: actorFrom(user),
    batchId: String(formData.get("batchId") ?? "") || null,
    reason: String(formData.get("reason") ?? "") || null,
  });
  revalidateAdmission(editionId);
}

export async function rejectSubmissionAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await rejectSubmission({
    editionId,
    submissionId: String(formData.get("submissionId") ?? ""),
    actor: actorFrom(user),
    publicReason: String(formData.get("publicReason") ?? ""),
    internalReason: String(formData.get("internalReason") ?? ""),
    exclude: formData.get("exclude") === "1",
  });
  revalidateAdmission(editionId);
}

export async function resolveManualReviewAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await resolveManualReview({
    editionId,
    submissionId: String(formData.get("submissionId") ?? ""),
    actor: actorFrom(user),
    decision: String(formData.get("decision") ?? "KEEP_REVIEW") as
      | "ADMIT"
      | "REJECT"
      | "KEEP_REVIEW",
    notes: String(formData.get("notes") ?? ""),
    publicReason: String(formData.get("publicReason") ?? "") || undefined,
  });
  revalidateAdmission(editionId);
}

export async function evaluatePendingBulkAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await evaluatePendingBulk({
    editionId,
    actor: actorFrom(user),
    requestId: String(formData.get("requestId") ?? crypto.randomUUID()),
    limit: Number(formData.get("limit") ?? 100) || 100,
  });
  revalidateAdmission(editionId);
}

export async function ensureDraftBatchAction(editionId: string) {
  const user = await requireClickatonAdmin();
  await getOrCreateDraftBatch({ editionId, actor: actorFrom(user) });
  revalidateAdmission(editionId);
}

export async function closeBatchAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await closeAdmissionBatch({
    editionId,
    batchId: String(formData.get("batchId") ?? ""),
    actor: actorFrom(user),
    force: formData.get("force") === "1",
  });
  revalidateAdmission(editionId);
}

export async function freezeBatchAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await freezeAdmittedEntries({
    editionId,
    batchId: String(formData.get("batchId") ?? ""),
    actor: actorFrom(user),
  });
  revalidateAdmission(editionId);
}

export async function reopenBatchAction(editionId: string, formData: FormData) {
  const user = await requireClickatonAdmin();
  await reopenAdmissionBatch({
    editionId,
    batchId: String(formData.get("batchId") ?? ""),
    actor: actorFrom(user),
    reason: String(formData.get("reason") ?? ""),
  });
  revalidateAdmission(editionId);
}
