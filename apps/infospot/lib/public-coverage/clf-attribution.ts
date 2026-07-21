/**
 * Atribución Info Spot → CLF en URLs de álbum/compra.
 * Marca al redactor (authorId) de la nota para comisión futura.
 */

export type InfospotClfAttribution = {
  articleId?: string | null;
  authorId?: number | null;
  eventId?: string | null;
};

/** Appendea params de atribución a una URL CLF (idempotente). */
export function appendInfospotAttributionToClfUrl(
  url: string,
  attribution: InfospotClfAttribution,
): string {
  try {
    const u = new URL(url);
    u.searchParams.set("source", "infospot");
    if (attribution.articleId) {
      u.searchParams.set("is_article", attribution.articleId);
    }
    if (
      attribution.authorId != null &&
      Number.isFinite(attribution.authorId) &&
      attribution.authorId > 0
    ) {
      u.searchParams.set("is_author", String(attribution.authorId));
    }
    if (attribution.eventId) {
      u.searchParams.set("is_event", attribution.eventId);
    }
    return u.toString();
  } catch {
    return url;
  }
}
