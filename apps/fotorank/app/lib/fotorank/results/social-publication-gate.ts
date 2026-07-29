/**
 * Gate Social Publisher para resultados — Etapa 15 no dispara LIVE.
 */
export type SocialResultsGateInput = {
  batchStatus: string;
  publicationApproved: boolean;
  resultsReleaseReached: boolean;
  consentsValid: boolean;
  liveEnabled: boolean;
};

export type SocialResultsGateResult =
  | { allowed: false; reason: string }
  | { allowed: true };

export function assertCanEnqueueResultsSocialPublish(
  input: SocialResultsGateInput,
): SocialResultsGateResult {
  if (input.liveEnabled) {
    return { allowed: false, reason: "LIVE_DISABLED_ETAPA_15" };
  }
  if (input.batchStatus !== "FINALIZED" && input.batchStatus !== "PUBLISHED") {
    return { allowed: false, reason: "BATCH_NOT_FINALIZED" };
  }
  if (!input.publicationApproved) {
    return { allowed: false, reason: "PUBLICATION_NOT_APPROVED" };
  }
  if (!input.resultsReleaseReached) {
    return { allowed: false, reason: "RESULTS_RELEASE_NOT_REACHED" };
  }
  if (!input.consentsValid) {
    return { allowed: false, reason: "CONSENTS_INVALID" };
  }
  // Etapa 15: aunque pase, no encolar LIVE.
  return { allowed: false, reason: "ETAPA_15_NO_LIVE_PUBLISH" };
}

export const RESULT_MEDIA_TEMPLATE_IDS = [
  "clickaton.results.winner.draft",
  "clickaton.results.finalist.draft",
  "clickaton.results.mention.draft",
  "clickaton.results.top10.draft",
] as const;
