/**
 * Mapeo exhaustivo EventType CLF → slug de categoría Info Spot.
 * No crea categorías; usa fallback documentado si el slug no existe en DB.
 */

import { CLF_EVENT_TYPES, type ClfEventType } from "./types";
export { CLF_EVENT_TYPES, type ClfEventType };

export const DEFAULT_CATEGORY_FALLBACK_SLUG = "eventos";

export type CategoryMapResult = {
  slug: string;
  usedFallback: boolean;
  reason: string;
};

/**
 * Tabla exhaustiva: cada EventType del schema tiene decisión explícita.
 * Slugs seed Info Spot: deportes, cultura, fotografia, eventos.
 */
export const CLF_EVENT_TYPE_TO_CATEGORY_SLUG: Record<ClfEventType, string> = {
  SPORTS: "deportes",
  CONCERT: "cultura",
  FESTIVAL: "cultura",
  CONFERENCE: "cultura",
  RELIGIOUS: "cultura",
  PUBLIC_PHOTOGRAPHY: "fotografia",
  THEMATIC_SESSIONS: "fotografia",
  COMMERCIAL_SESSIONS: "fotografia",
  PUBLIC_SESSION: "fotografia",
  PRIVATE_SESSION: "fotografia",
  SCHOOL: "eventos",
  WEDDING: "eventos",
  BIRTHDAY: "eventos",
  GRADUATION: "eventos",
  CORPORATE: "eventos",
  OTHER: "eventos",
};

export function mapClfEventTypeToInfoSpotCategorySlug(
  eventType: string,
): CategoryMapResult {
  if ((CLF_EVENT_TYPES as readonly string[]).includes(eventType)) {
    const slug = CLF_EVENT_TYPE_TO_CATEGORY_SLUG[eventType as ClfEventType];
    return {
      slug,
      usedFallback: false,
      reason: `mapped_from_${eventType}`,
    };
  }
  return {
    slug: DEFAULT_CATEGORY_FALLBACK_SLUG,
    usedFallback: true,
    reason: `unknown_event_type_${eventType || "empty"}`,
  };
}

/** Garantiza cobertura de tests: todos los EventType tienen entrada. */
export function assertExhaustiveCategoryMap(): void {
  for (const type of CLF_EVENT_TYPES) {
    if (!(type in CLF_EVENT_TYPE_TO_CATEGORY_SLUG)) {
      throw new Error(`Falta mapeo de categoría para EventType ${type}`);
    }
  }
}
