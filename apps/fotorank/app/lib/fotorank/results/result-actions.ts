"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "../../auth";
import { assertOrganizerCanAccessContest } from "../registration";
import {
  activateResultRuleSet,
  ensureDraftResultRuleSet,
  finalizeResultBatch,
  generateResultBatch,
  markResultBatchReviewed,
} from "./result-service";

async function requireOrganizer(contestId: string) {
  const user = await requireAuth();
  await assertOrganizerCanAccessContest(contestId, user.id);
  return user;
}

export async function ensureResultRuleSetAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await ensureDraftResultRuleSet({
    contestId,
    scoringSessionId: String(formData.get("scoringSessionId") ?? ""),
    actorUserId: user.id,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/resultados`);
}

export async function activateResultRuleSetAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await activateResultRuleSet({
    contestId,
    ruleSetId: String(formData.get("ruleSetId") ?? ""),
    actorUserId: user.id,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/resultados`);
}

export async function generateResultBatchAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await generateResultBatch({
    contestId,
    scoringSessionId: String(formData.get("scoringSessionId") ?? ""),
    ruleSetId: String(formData.get("ruleSetId") ?? ""),
    actorUserId: user.id,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/resultados`);
}

export async function reviewResultBatchAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await markResultBatchReviewed({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/resultados`);
}

export async function finalizeResultBatchAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await finalizeResultBatch({
    contestId,
    batchId: String(formData.get("batchId") ?? ""),
    actorUserId: user.id,
    force: formData.get("force") === "1",
    reason: String(formData.get("reason") ?? "") || null,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/resultados`);
}
