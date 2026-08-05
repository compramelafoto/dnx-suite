"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "../../auth";
import { assertOrganizerCanAccessContest } from "../registration";
import {
  confirmAwardsConfig,
  confirmRubricForPublication,
  configureFinalists,
  deriveWinnersFromRanking,
  publishResultBatch,
  revokeResultPublication,
  setInstitutionalReview,
  setLegalReview,
} from "./publication-service";

async function requireOrganizer(contestId: string) {
  const user = await requireAuth();
  await assertOrganizerCanAccessContest(contestId, user.id);
  return user;
}

function revalidateResults(contestId: string) {
  revalidatePath(`/dashboard/concursos/${contestId}/resultados`);
  revalidatePath(`/dashboard/concursos/${contestId}/resultados/preview`);
}

export async function stagingConfirmRubricAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await confirmRubricForPublication({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    status: "STAGING_TEST_CONFIGURATION",
    note: "STAGING_TEST_CONFIGURATION — no oficial",
  });
  revalidateResults(contestId);
}

export async function stagingConfirmAwardsAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await confirmAwardsConfig({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    status: "STAGING_TEST_CONFIGURATION",
  });
  revalidateResults(contestId);
}

export async function configureFinalistsAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await configureFinalists({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    status: "STAGING_TEST_CONFIGURATION",
    mode: "AUTO_TOP_N",
    defaultTopN: Number(formData.get("topN") ?? 3) || 3,
  });
  revalidateResults(contestId);
}

export async function deriveWinnersAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await deriveWinnersFromRanking({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
  });
  revalidateResults(contestId);
}

export async function approveInstitutionalAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await setInstitutionalReview({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    status: "APPROVED",
    notes: String(formData.get("notes") ?? "staging institutional approval"),
  });
  revalidateResults(contestId);
}

export async function approveLegalAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await setLegalReview({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    status: "APPROVED",
    notes: "STAGING legal status only — NOT legal advice",
    basesVersionRef: "staging-draft",
    privacyVersionRef: "staging-draft",
  });
  revalidateResults(contestId);
}

export async function publishStagingTestAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await publishResultBatch({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    expectedHash: String(formData.get("expectedHash") ?? ""),
    confirmationPhrase: String(formData.get("confirmationPhrase") ?? ""),
    idempotencyKey: String(formData.get("idempotencyKey") ?? `pub-${Date.now()}`),
    stagingTest: true,
  });
  revalidateResults(contestId);
}

export async function revokePublicationAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await revokeResultPublication({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    reason: String(formData.get("reason") ?? "staging cleanup"),
  });
  revalidateResults(contestId);
}
