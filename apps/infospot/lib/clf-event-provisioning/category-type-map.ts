/**
 * Mapeo categoría editorial Info Spot → EventType CLF (sugerido).
 * El redactor puede sobrescribir clfEventType en la convocatoria.
 */

import { CLF_EVENT_TYPES, type ClfEventType } from "../clf-event-sync/types";

export const INFOSPOT_CATEGORY_TO_CLF_TYPE: Record<string, ClfEventType> = {
  deportes: "SPORTS",
  cultura: "CONCERT",
  fotografia: "PUBLIC_PHOTOGRAPHY",
  eventos: "OTHER",
};

export function mapInfoSpotCategoryToClfEventType(
  categorySlug: string | null | undefined,
): { type: ClfEventType; reason: string } {
  if (!categorySlug?.trim()) {
    return { type: "OTHER", reason: "no_category" };
  }
  const mapped = INFOSPOT_CATEGORY_TO_CLF_TYPE[categorySlug.trim().toLowerCase()];
  if (mapped) return { type: mapped, reason: `from_category_${categorySlug}` };
  return { type: "OTHER", reason: `unknown_category_${categorySlug}` };
}

export function isValidClfEventType(value: string): value is ClfEventType {
  return (CLF_EVENT_TYPES as readonly string[]).includes(value);
}

export { CLF_EVENT_TYPES };
