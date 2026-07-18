import { extractCity } from "./extract-city.js";
import { extractEventDate, type ExtractDateOptions } from "./extract-date.js";
import { extractDurationHours } from "./extract-duration.js";
import { extractServiceType } from "./extract-service-type.js";
import { getMissingQuoteFields } from "./get-missing-fields.js";
import type {
  QuoteExtractionResult,
  QuoteRequestDraft,
  QuoteRequiredField,
} from "./models.js";

export type ExtractQuoteRequestOptions = ExtractDateOptions;

function collectedFields(draft: QuoteRequestDraft): QuoteRequiredField[] {
  const fields: QuoteRequiredField[] = [];
  if (draft.serviceType && draft.serviceType !== "UNKNOWN") fields.push("SERVICE_TYPE");
  if (draft.eventDate) fields.push("EVENT_DATE");
  if (draft.city) fields.push("CITY");
  if (draft.durationHours !== undefined) fields.push("DURATION_HOURS");
  return fields;
}

/**
 * Extracción determinística de datos de presupuesto.
 * No inventa valores. Sin precios ni IA.
 */
export function extractQuoteRequest(
  normalizedText: string,
  options: ExtractQuoteRequestOptions = {},
): QuoteExtractionResult {
  const warnings: string[] = [];
  const draft: QuoteRequestDraft = {};

  const serviceType = extractServiceType(normalizedText);
  if (serviceType) draft.serviceType = serviceType;

  const dateResult = extractEventDate(normalizedText, options);
  warnings.push(...dateResult.warnings);
  if (dateResult.eventDate) draft.eventDate = dateResult.eventDate;

  const city = extractCity(normalizedText);
  if (city) draft.city = city;

  const durationResult = extractDurationHours(normalizedText);
  warnings.push(...durationResult.warnings);
  if (durationResult.durationHours !== undefined) {
    draft.durationHours = durationResult.durationHours;
  }

  const missingFields = getMissingQuoteFields(draft);

  return {
    draft,
    extractedFields: collectedFields(draft),
    missingFields,
    warnings,
  };
}
