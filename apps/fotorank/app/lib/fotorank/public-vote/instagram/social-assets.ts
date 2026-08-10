/**
 * ETAPA 17B — Derivados sociales + caption templates (sin PII / sin score jurado).
 */
import { createHash } from "node:crypto";

export type SocialAssetSnapshot = {
  publicCode: string;
  promptExternalId: string;
  promptSequence?: number;
  derivativeAssetKey: string | null;
  socialAssetHash: string;
  watermarkApplied: boolean;
};

export function buildSocialAssetSnapshot(input: {
  publicCode: string;
  promptExternalId: string;
  promptSequence?: number;
  derivativeAssetKey: string | null;
}): SocialAssetSnapshot {
  const raw = `${input.publicCode}|${input.promptExternalId}|${input.derivativeAssetKey ?? ""}`;
  return {
    publicCode: input.publicCode,
    promptExternalId: input.promptExternalId,
    promptSequence: input.promptSequence,
    derivativeAssetKey: input.derivativeAssetKey,
    socialAssetHash: createHash("sha256").update(raw).digest("hex").slice(0, 32),
    watermarkApplied: true,
  };
}

export function defaultCaptionTemplate(input: {
  publicCode: string;
  promptExternalId: string;
  promptLabel?: string;
  endsAt?: Date;
  timezone?: string | null;
}): string {
  const promptLabel = input.promptLabel ?? input.promptExternalId;
  const ends =
    input.endsAt && input.timezone
      ? input.endsAt.toLocaleString("es-AR", { timeZone: input.timezone })
      : input.endsAt?.toISOString() ?? "[fecha/hora]";
  return [
    `CLICKATÓN — ${promptLabel}`,
    `FINALISTA ${input.publicCode}`,
    "",
    "❤️ Tu Me Gusta cuenta como voto.",
    "",
    `La votación finaliza: ${ends}`,
  ].join("\n");
}
