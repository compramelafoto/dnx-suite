/** Tipos para sugerencias de eventos similares (Info Spot + CLF). */

export type SimilarEventHit = {
  source: "INFOSPOT" | "CLF";
  id: string;
  title: string;
  startsAt: string | null;
  city: string | null;
  province?: string | null;
  locationName?: string | null;
};

export function buildSimilarEventsQuery(parts: {
  eventName?: string;
  city?: string;
  province?: string;
}): string {
  return [parts.eventName, parts.city, parts.province]
    .map((p) => (p ?? "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}
