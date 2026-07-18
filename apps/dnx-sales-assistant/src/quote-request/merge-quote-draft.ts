import type { QuoteRequestDraft } from "./models.js";

export type MergeQuoteDraftResult = {
  draft: QuoteRequestDraft;
  warnings: string[];
};

/**
 * Merge puro e inmutable del draft de presupuesto.
 * No sobrescribe con undefined; solo reemplaza con valores nuevos explícitos.
 */
export function mergeQuoteRequestDraft(
  currentDraft: QuoteRequestDraft | undefined,
  newlyExtractedDraft: QuoteRequestDraft,
): MergeQuoteDraftResult {
  const warnings: string[] = [];
  const base: QuoteRequestDraft = currentDraft ? { ...currentDraft } : {};
  const next: QuoteRequestDraft = { ...base };

  if (newlyExtractedDraft.serviceType !== undefined) {
    next.serviceType = newlyExtractedDraft.serviceType;
  }
  if (newlyExtractedDraft.eventDate !== undefined) {
    next.eventDate = newlyExtractedDraft.eventDate;
  }
  if (newlyExtractedDraft.city !== undefined) {
    next.city = newlyExtractedDraft.city;
  }
  if (newlyExtractedDraft.durationHours !== undefined) {
    next.durationHours = newlyExtractedDraft.durationHours;
  }
  if (newlyExtractedDraft.guestCount !== undefined) {
    next.guestCount = newlyExtractedDraft.guestCount;
  }
  if (newlyExtractedDraft.venueType !== undefined) {
    next.venueType = newlyExtractedDraft.venueType;
  }

  return { draft: next, warnings };
}
