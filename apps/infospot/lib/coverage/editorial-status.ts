/**
 * Estado editorial agregado de una cobertura (no publica contenido).
 *
 * ETAPA 15: READY_TO_PUBLISH se trata igual que IN_REVIEW (alias).
 */

export type CoverageArticleStatusInput = {
  status: string;
};

export type CoverageEditorialStatus =
  | "UNASSIGNED"
  | "DRAFTING"
  | "IN_REVIEW"
  | "READY"
  | "PUBLISHED"
  | "STALE";

/**
 * Deriva estado editorial desde artículos vinculados + sync STALE.
 * Prioridad: STALE > PUBLISHED > IN_REVIEW (incluye READY_TO_PUBLISH) > DRAFTING > UNASSIGNED.
 */
export function deriveCoverageEditorialStatus(input: {
  syncStatus: string;
  discoveryStatus: string;
  articles: CoverageArticleStatusInput[];
}): CoverageEditorialStatus {
  if (input.syncStatus === "STALE" || input.syncStatus === "DISABLED") {
    return "STALE";
  }
  if (input.discoveryStatus === "DISMISSED") {
    return "UNASSIGNED";
  }
  if (input.articles.length === 0) return "UNASSIGNED";

  const statuses = new Set(input.articles.map((a) => a.status));
  if (statuses.has("PUBLISHED")) return "PUBLISHED";
  // READY_TO_PUBLISH es alias de IN_REVIEW en ETAPA 15
  if (statuses.has("READY_TO_PUBLISH") || statuses.has("IN_REVIEW")) return "IN_REVIEW";
  if (statuses.has("DRAFT") || statuses.has("UNPUBLISHED")) return "DRAFTING";
  return "DRAFTING";
}
