"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "../../../../../lib/auth";
import { assertOrganizerCanAccessContest } from "../../../../../lib/fotorank/registration";
import { RegistrationError } from "../../../../../lib/fotorank/registration";
import {
  buildSantaFeEnFoco2026Configuration,
  buildChatGptRulesPrompt,
  compareRulesTextWithConfiguration,
  importRulesTextDraft,
  publishConfigurationVersion,
  saveDraftConfiguration,
  validateContestRulesConfiguration,
  RulesConfigError,
  type ContestRulesConfiguration,
} from "../../../../../lib/fotorank/rules-config";

async function guard(contestId: string) {
  const user = await requireAuth();
  await assertOrganizerCanAccessContest(contestId, user.id);
  return user;
}

export async function saveConfigurationDraftAction(contestId: string, config: ContestRulesConfiguration) {
  try {
    const user = await guard(contestId);
    const result = await saveDraftConfiguration({
      contestId,
      config,
      createdByUserId: user.id,
    });
    revalidatePath(`/dashboard/concursos/${contestId}/configuracion`);
    return { ok: true as const, ...result };
  } catch (e) {
    if (e instanceof RegistrationError || e instanceof RulesConfigError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  }
}

export async function loadSantaFePresetAction(contestId: string) {
  try {
    const user = await guard(contestId);
    const config = buildSantaFeEnFoco2026Configuration();
    const result = await saveDraftConfiguration({
      contestId,
      config,
      createdByUserId: user.id,
    });
    revalidatePath(`/dashboard/concursos/${contestId}/configuracion`);
    return { ok: true as const, config, ...result };
  } catch (e) {
    if (e instanceof RegistrationError || e instanceof RulesConfigError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  }
}

export async function publishConfigurationAction(contestId: string, versionId: string) {
  try {
    const user = await guard(contestId);
    // Publicación formal bloquea pendientes humanos.
    const result = await publishConfigurationVersion({
      contestId,
      versionId,
      actorUserId: user.id,
      allowPendingHuman: false,
    });
    revalidatePath(`/dashboard/concursos/${contestId}`);
    revalidatePath(`/dashboard/concursos/${contestId}/configuracion`);
    return { ok: true as const, ...result };
  } catch (e) {
    if (e instanceof RegistrationError || e instanceof RulesConfigError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  }
}

/** Solo staging/admin técnico: aplica políticas aunque haya pendientes humanos. */
export async function applyConfigurationTechnicalAction(contestId: string, versionId: string) {
  try {
    const user = await guard(contestId);
    const result = await publishConfigurationVersion({
      contestId,
      versionId,
      actorUserId: user.id,
      allowPendingHuman: true,
    });
    revalidatePath(`/dashboard/concursos/${contestId}`);
    return { ok: true as const, ...result };
  } catch (e) {
    if (e instanceof RegistrationError || e instanceof RulesConfigError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  }
}

export async function getChatGptPromptAction(contestId: string, config: ContestRulesConfiguration) {
  await guard(contestId);
  const validation = validateContestRulesConfiguration(config);
  return { ok: true as const, prompt: buildChatGptRulesPrompt(config), validation };
}

export async function importBasesTextAction(
  contestId: string,
  configurationVersionId: string,
  title: string,
  content: string,
) {
  try {
    const user = await guard(contestId);
    const result = await importRulesTextDraft({
      contestId,
      configurationVersionId,
      title,
      content,
      createdByUserId: user.id,
    });
    revalidatePath(`/dashboard/concursos/${contestId}/bases`);
    return { ok: true as const, ...result };
  } catch (e) {
    if (e instanceof RegistrationError || e instanceof RulesConfigError) {
      return { ok: false as const, error: e.message };
    }
    throw e;
  }
}

export async function compareBasesTextAction(contestId: string, config: ContestRulesConfiguration, text: string) {
  await guard(contestId);
  return { ok: true as const, items: compareRulesTextWithConfiguration(text, config) };
}
