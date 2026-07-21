/**
 * Helpers de tracking seguro para CTAs públicos.
 */

import { appendInfospotAttributionToClfUrl } from "./clf-attribution";

export function buildTrackedHref(input: {
  to: string;
  kind: "ALBUM_CLICK" | "PURCHASE_CLICK" | "EVENT_CLICK" | "CLF_REGISTRATION_CLICK";
  articleId?: string | null;
  eventId?: string | null;
  /** Redactor / autor de la nota (User.id Info Spot). */
  authorId?: number | null;
}): string {
  const to = appendInfospotAttributionToClfUrl(input.to, {
    articleId: input.articleId,
    authorId: input.authorId,
    eventId: input.eventId,
  });
  const params = new URLSearchParams({
    to,
    kind: input.kind,
  });
  if (input.articleId) params.set("articleId", input.articleId);
  if (input.eventId) params.set("eventId", input.eventId);
  if (
    input.authorId != null &&
    Number.isFinite(input.authorId) &&
    input.authorId > 0
  ) {
    params.set("authorId", String(input.authorId));
  }
  return `/api/r?${params.toString()}`;
}
