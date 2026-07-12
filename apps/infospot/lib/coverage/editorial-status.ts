/**
 * Estado editorial agregado de una cobertura (no publica contenido).
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
 * Prioridad: STALE > PUBLISHED > READY > IN_REVIEW > DRAFTING > UNASSIGNED.
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
  if (statuses.has("READY_TO_PUBLISH")) return "READY";
  if (statuses.has("IN_REVIEW")) return "IN_REVIEW";
  if (statuses.has("DRAFT") || statuses.has("UNPUBLISHED")) return "DRAFTING";
  return "DRAFTING";
}
