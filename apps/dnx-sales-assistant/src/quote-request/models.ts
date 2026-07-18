export type PhotographyServiceType =
  | "WEDDING"
  | "FIFTEENTH_BIRTHDAY"
  | "BIRTHDAY"
  | "CORPORATE_EVENT"
  | "SOCIAL_EVENT"
  | "PORTRAIT_SESSION"
  | "FAMILY_SESSION"
  | "PRODUCT_PHOTOGRAPHY"
  | "SCHOOL_PHOTOGRAPHY"
  | "SPORTS_EVENT"
  | "OTHER"
  | "UNKNOWN";

export type VenueType = "INDOOR" | "OUTDOOR" | "MIXED" | "UNKNOWN";

export type QuoteRequiredField =
  | "SERVICE_TYPE"
  | "EVENT_DATE"
  | "CITY"
  | "DURATION_HOURS";

/** Orden estable de recolección de campos mínimos. */
export const QUOTE_REQUIRED_FIELDS_ORDER: readonly QuoteRequiredField[] = [
  "SERVICE_TYPE",
  "EVENT_DATE",
  "CITY",
  "DURATION_HOURS",
] as const;

export type QuoteRequestDraft = {
  serviceType?: PhotographyServiceType;
  eventDate?: string;
  city?: string;
  durationHours?: number;
  guestCount?: number;
  venueType?: VenueType;
};

export type QuoteRequestStatus =
  | "NOT_APPLICABLE"
  | "COLLECTING_INFORMATION"
  | "READY_FOR_CALCULATION";

export type QuoteExtractionResult = {
  draft: QuoteRequestDraft;
  extractedFields: QuoteRequiredField[];
  missingFields: QuoteRequiredField[];
  warnings: string[];
};

export type QuoteRequestPayload = {
  status: QuoteRequestStatus;
  draft: QuoteRequestDraft;
  missingFields: QuoteRequiredField[];
  nextQuestion?: string;
  warnings: string[];
};

/** Horas documentadas para duraciones cualitativas. */
export const HALF_DAY_HOURS = 4;
export const FULL_DAY_HOURS = 8;
export const MIN_DURATION_HOURS = 1;
export const MAX_DURATION_HOURS = 24;
