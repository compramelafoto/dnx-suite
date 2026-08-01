import type { StagePlan } from "./schema.js";

export type PromptEnvelopeResult =
  | { ok: true; envelope: string }
  | { ok: false; reason: string };

function meaningfulLines(prompt: string): string[] {
  return prompt
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function buildStageEnvelope(stageNumber: number, title: string, project?: string): string {
  const parts = [`ETAPA ${String(stageNumber).padStart(2, "0")}`];
  if (project?.trim()) parts.push(project.trim().toUpperCase());
  parts.push(title.trim());
  return parts.join(" — ");
}

/**
 * Validates DNX prompt envelope:
 * first meaningful line == last meaningful line
 * and both contain ETAPA + stageNumber + title.
 */
export function validatePromptEnvelope(
  prompt: string,
  stageNumber: number,
  title: string,
): PromptEnvelopeResult {
  const lines = meaningfulLines(prompt);
  if (lines.length < 2) {
    return { ok: false, reason: "Prompt must contain at least two meaningful lines (envelope start/end)." };
  }

  const first = lines[0];
  const last = lines[lines.length - 1];
  if (!first || !last) {
    return { ok: false, reason: "Prompt envelope lines missing." };
  }
  if (first !== last) {
    return { ok: false, reason: "First and last meaningful lines must be identical." };
  }

  const upper = first.toUpperCase();
  if (!upper.includes("ETAPA")) {
    return { ok: false, reason: 'Envelope must include "ETAPA".' };
  }

  const stageToken = String(stageNumber);
  const stageTokenPadded = stageToken.padStart(2, "0");
  if (!first.includes(stageToken) && !first.includes(stageTokenPadded)) {
    return { ok: false, reason: `Envelope must include stageNumber ${stageToken}.` };
  }

  if (!first.toLowerCase().includes(title.trim().toLowerCase())) {
    return { ok: false, reason: "Envelope must include the stage title." };
  }

  return { ok: true, envelope: first };
}

export function validateLegalActionInPrompt(prompt: string): { ok: true } | { ok: false; reason: string } {
  if (!/ACCI[ÓO]N LEGAL REQUERIDA\s*:\s*(S[ÍI]|NO)\b/i.test(prompt)) {
    return {
      ok: false,
      reason: "Prompt must declare ACCIÓN LEGAL REQUERIDA: SÍ | NO",
    };
  }
  return { ok: true };
}

export function validateStagePlanContract(stage: StagePlan): { ok: true } | { ok: false; reason: string } {
  const envelope = validatePromptEnvelope(stage.prompt, stage.stageNumber, stage.title);
  if (!envelope.ok) return envelope;
  const legal = validateLegalActionInPrompt(stage.prompt);
  if (!legal.ok) return legal;
  if (!/NO comenzar automáticamente/i.test(stage.prompt) && !/NOT automatically begin/i.test(stage.prompt)) {
    return {
      ok: false,
      reason: "Prompt must instruct NOT to automatically begin the next stage.",
    };
  }
  return { ok: true };
}
