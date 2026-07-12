/**
 * Helpers de tracking seguro para CTAs públicos.
 */

export function buildTrackedHref(input: {
  to: string;
  kind: "ALBUM_CLICK" | "PURCHASE_CLICK" | "EVENT_CLICK" | "CLF_REGISTRATION_CLICK";
  articleId?: string | null;
  eventId?: string | null;
}): string {
  const params = new URLSearchParams({
    to: input.to,
    kind: input.kind,
  });
  if (input.articleId) params.set("articleId", input.articleId);
  if (input.eventId) params.set("eventId", input.eventId);
  return `/api/r?${params.toString()}`;
}
