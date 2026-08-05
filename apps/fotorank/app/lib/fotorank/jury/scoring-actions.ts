"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@repo/db";
import { requireAuth } from "../../auth";
import { assertOrganizerCanAccessContest } from "../registration";
import {
  activateRubric,
  closeScoringSession,
  ensureDraftScoringSession,
  getCoverageReport,
  openScoringSession,
} from "./scoring-session-service";

async function requireOrganizer(contestId: string) {
  const user = await requireAuth();
  await assertOrganizerCanAccessContest(contestId, user.id);
  return user;
}

export { getCoverageReport };

export async function ensureScoringSessionAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  const admissionBatchId = String(formData.get("admissionBatchId") ?? "");
  await ensureDraftScoringSession({
    contestId,
    admissionBatchId,
    actorUserId: user.id,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/jurado`);
}

export async function activateRubricAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await activateRubric({
    contestId,
    rubricId: String(formData.get("rubricId") ?? ""),
    actorUserId: user.id,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/jurado`);
}

export async function openScoringSessionAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  await openScoringSession({
    contestId,
    sessionId: String(formData.get("sessionId") ?? ""),
    actorUserId: user.id,
  });
  revalidatePath(`/dashboard/concursos/${contestId}/jurado`);
}

export async function closeScoringSessionAction(contestId: string, formData: FormData) {
  const user = await requireOrganizer(contestId);
  const { JuryError } = await import("./errors");
  const { redirect } = await import("next/navigation");
  let closeError: string | null = null;
  try {
    await closeScoringSession({
      contestId,
      sessionId: String(formData.get("sessionId") ?? ""),
      actorUserId: user.id,
      force: formData.get("force") === "1",
      reason: String(formData.get("reason") ?? "") || null,
    });
  } catch (err) {
    // redirect() lanza; no capturar NEXT_REDIRECT dentro del mismo catch que JuryError.
    if (err instanceof JuryError) {
      closeError = err.code;
    } else {
      throw err;
    }
  }
  if (closeError) {
    redirect(
      `/dashboard/concursos/${contestId}/jurado?closeError=${encodeURIComponent(closeError)}`,
    );
  }
  revalidatePath(`/dashboard/concursos/${contestId}/jurado`);
}

export async function listFrozenBatchesForContest(contestId: string) {
  return prisma.fotorankAdmissionBatch.findMany({
    where: { contestId, status: "FROZEN" },
    orderBy: { frozenAt: "desc" },
    select: { id: true, frozenAt: true, frozenEntries: true, editionId: true },
  });
}
