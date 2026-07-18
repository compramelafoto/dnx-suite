import {
  QUOTE_REQUIRED_FIELDS_ORDER,
  type QuoteRequestDraft,
  type QuoteRequiredField,
} from "./models.js";

export function getMissingQuoteFields(draft: QuoteRequestDraft): QuoteRequiredField[] {
  const missing: QuoteRequiredField[] = [];

  for (const field of QUOTE_REQUIRED_FIELDS_ORDER) {
    switch (field) {
      case "SERVICE_TYPE":
        if (!draft.serviceType || draft.serviceType === "UNKNOWN") {
          missing.push(field);
        }
        break;
      case "EVENT_DATE":
        if (!draft.eventDate) missing.push(field);
        break;
      case "CITY":
        if (!draft.city) missing.push(field);
        break;
      case "DURATION_HOURS":
        if (draft.durationHours === undefined) missing.push(field);
        break;
    }
  }

  return missing;
}
