"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "../../../../../lib/auth";
import { assertOrganizerCanAccessContest, RegistrationError } from "../../../../../lib/fotorank/registration";
import {
  RulesLifecycleError,
  approveRulesVersion,
  generateRulesPromptForContest,
  importRulesDocument,
  importStructuredRulesResponse,
  markLegalReview,
  publishContestRulesVersion,
  requestRulesChanges,
  revalidateRulesCompare,
  seedSantaFeRulesDraft,
  submitRulesForReview,
} from "../../../../../lib/fotorank/rules-lifecycle";
import { getPublishedConfiguration } from "../../../../../lib/fotorank/rules-config";

async function guard(contestId: string) {
  const user = await requireAuth();
  await assertOrganizerCanAccessContest(contestId, user.id);
  return user;
}

function mapErr(e: unknown) {
  if (e instanceof RegistrationError || e instanceof RulesLifecycleError) {
    return { ok: false as const, error: e.message, code: e.code };
  }
  throw e;
}

export async function generatePromptAction(contestId: string) {
  try {
    await guard(contestId);
    const result = await generateRulesPromptForContest(contestId);
    return { ok: true as const, ...result };
  } catch (e) {
    return mapErr(e);
  }
}

export async function importDocumentAction(contestId: string, title: string, content: string) {
  try {
    const user = await guard(contestId);
    const cfg = await getPublishedConfiguration(contestId);
    if (!cfg) return { ok: false as const, error: "No hay configuración publicada.", code: "CONFIG" };
    const result = await importRulesDocument({
      contestId,
      configurationVersionId: cfg.id,
      title,
      content,
      createdByUserId: user.id,
    });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const, ...result };
  } catch (e) {
    return mapErr(e);
  }
}

export async function importStructuredAction(contestId: string, rawJson: string) {
  try {
    const user = await guard(contestId);
    const cfg = await getPublishedConfiguration(contestId);
    if (!cfg) return { ok: false as const, error: "No hay configuración publicada.", code: "CONFIG" };
    const result = await importStructuredRulesResponse({
      contestId,
      configurationVersionId: cfg.id,
      rawJson,
      createdByUserId: user.id,
    });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const, ...result };
  } catch (e) {
    return mapErr(e);
  }
}

export async function seedSantaFeDraftAction(contestId: string) {
  try {
    const user = await guard(contestId);
    const cfg = await getPublishedConfiguration(contestId);
    if (!cfg) return { ok: false as const, error: "No hay configuración publicada.", code: "CONFIG" };
    const result = await seedSantaFeRulesDraft({
      contestId,
      configurationVersionId: cfg.id,
      createdByUserId: user.id,
    });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const, ...result };
  } catch (e) {
    return mapErr(e);
  }
}

export async function compareAction(contestId: string, rulesVersionId: string) {
  try {
    await guard(contestId);
    const result = await revalidateRulesCompare(rulesVersionId);
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const, ...result };
  } catch (e) {
    return mapErr(e);
  }
}

export async function submitReviewAction(contestId: string, rulesVersionId: string, notes?: string) {
  try {
    const user = await guard(contestId);
    await submitRulesForReview({ contestId, rulesVersionId, actorUserId: user.id, notes });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const };
  } catch (e) {
    return mapErr(e);
  }
}

export async function requestChangesAction(contestId: string, rulesVersionId: string, notes: string) {
  try {
    const user = await guard(contestId);
    await requestRulesChanges({ contestId, rulesVersionId, actorUserId: user.id, notes });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const };
  } catch (e) {
    return mapErr(e);
  }
}

export async function approveAction(contestId: string, rulesVersionId: string, notes?: string) {
  try {
    const user = await guard(contestId);
    await approveRulesVersion({ contestId, rulesVersionId, actorUserId: user.id, notes });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const };
  } catch (e) {
    return mapErr(e);
  }
}

export async function markLegalAction(
  contestId: string,
  rulesVersionId: string,
  status: "REVIEWED" | "CHANGES_REQUESTED" | "PENDING",
  notes?: string,
) {
  try {
    const user = await guard(contestId);
    await markLegalReview({ contestId, rulesVersionId, actorUserId: user.id, status, notes });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const };
  } catch (e) {
    return mapErr(e);
  }
}

export async function publishApprovedAction(contestId: string, rulesVersionId: string) {
  try {
    const user = await guard(contestId);
    // Local/staging: allowLegalPendingForLocal; producción bloquea PENDING.
    const allowLegalPendingForLocal =
      process.env.FOTORANK_APP_ENV !== "production" && process.env.NODE_ENV !== "production";
    const result = await publishContestRulesVersion({
      contestId,
      rulesVersionId,
      actorUserId: user.id,
      allowLegalPendingForLocal,
    });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    revalidatePath(`/dashboard/concursos/${contestId}`);
    return { ok: true as const, ...result };
  } catch (e) {
    return mapErr(e);
  }
}
