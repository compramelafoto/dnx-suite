/**
 * Cookie clf_infospot_attr: atribución de tráfico Info Spot al redactor de la nota.
 * Se setea en middleware cuando la URL trae source=infospot&is_author=…
 * Uso futuro: comisión / split de pagos al redactor.
 */

const COOKIE_NAME = "clf_infospot_attr";

export type InfospotAttributionCookie = {
  source: "infospot";
  authorId: number;
  articleId: string | null;
  eventId: string | null;
};

function readCookieRaw(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|;\\s*)" + encodeURIComponent(name) + "=([^;]*)")
  );
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function getInfospotAttributionCookie(): InfospotAttributionCookie | null {
  const raw = readCookieRaw(COOKIE_NAME);
  if (!raw?.trim()) return null;
  try {
    const parsed = JSON.parse(raw) as {
      source?: string;
      authorId?: number;
      articleId?: string | null;
      eventId?: string | null;
    };
    if (
      parsed.source !== "infospot" ||
      typeof parsed.authorId !== "number" ||
      !Number.isFinite(parsed.authorId) ||
      parsed.authorId <= 0
    ) {
      return null;
    }
    return {
      source: "infospot",
      authorId: parsed.authorId,
      articleId: parsed.articleId ?? null,
      eventId: parsed.eventId ?? null,
    };
  } catch {
    return null;
  }
}

/** Parsea query de landing CLF (prioridad sobre cookie). */
export function getInfospotAttributionFromSearchParams(
  params: URLSearchParams
): InfospotAttributionCookie | null {
  if (params.get("source") !== "infospot") return null;
  const authorRaw = params.get("is_author")?.trim() ?? "";
  if (!/^\d+$/.test(authorRaw)) return null;
  const authorId = parseInt(authorRaw, 10);
  if (authorId <= 0) return null;
  return {
    source: "infospot",
    authorId,
    articleId: params.get("is_article")?.trim() || null,
    eventId: params.get("is_event")?.trim() || null,
  };
}
