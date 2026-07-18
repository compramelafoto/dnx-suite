import type { QuoteRequestDraft } from "../../quote-request/models.js";

/** Huella estable del draft cotizable (invalidación / cache). */
export function draftFingerprint(draft: QuoteRequestDraft | undefined): string {
  if (!draft) return "draft:empty";
  return JSON.stringify({
    serviceType: draft.serviceType ?? null,
    eventDate: draft.eventDate ?? null,
    city: draft.city ?? null,
    durationHours: draft.durationHours ?? null,
  });
}

export function buildPricingCacheKey(input: {
  draft: QuoteRequestDraft;
  profileVersion: string;
  templateVersion: string;
  formulaVersion: string;
}): string {
  return JSON.stringify({
    draft: draftFingerprint(input.draft),
    profileVersion: input.profileVersion,
    templateVersion: input.templateVersion,
    formulaVersion: input.formulaVersion,
  });
}
