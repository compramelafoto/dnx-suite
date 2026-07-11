export const ARTICLE_STATUSES = ["DRAFT", "PUBLISHED", "UNPUBLISHED", "ARCHIVED"] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const STATUS_LABELS: Record<ArticleStatus, string> = {
  DRAFT: "Borrador",
  PUBLISHED: "Publicada",
  UNPUBLISHED: "Despublicada",
  ARCHIVED: "Archivada",
};

export function canTransitionStatus(from: ArticleStatus, to: ArticleStatus): boolean {
  if (from === to) return true;
  if (to === "ARCHIVED") return from !== "ARCHIVED";
  if (to === "PUBLISHED") return from === "DRAFT" || from === "UNPUBLISHED";
  if (to === "UNPUBLISHED") return from === "PUBLISHED";
  if (to === "DRAFT") return false;
  return false;
}
