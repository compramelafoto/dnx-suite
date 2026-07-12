/** Contexto de importación con IA (manual: prompt externo + CSV). */
export type AiImportContext = "EVENT" | "ARTICLE";

export const EVENT_CSV_HEADERS = [
  "event_name",
  "short_description",
  "full_description",
  "category",
  "subcategory",
  "start_date",
  "start_time",
  "end_date",
  "end_time",
  "venue_name",
  "address",
  "city",
  "province",
  "country",
  "organizer_name",
  "organizer_email",
  "organizer_phone",
  "website_url",
  "registration_url",
  "ticket_url",
  "instagram_url",
  "facebook_url",
  "requires_photographers",
  "requires_participants",
  "photographer_call_description",
  "participant_call_description",
  "is_free",
  "price",
  "currency",
  "source_name",
  "source_url",
  "image_alt",
  "image_credit",
  "notes_for_editor",
] as const;

export const ARTICLE_CSV_HEADERS = [
  "title",
  "subtitle",
  "excerpt",
  "body_markdown",
  "category",
  "subcategory",
  "author_name",
  "event_name",
  "event_date",
  "city",
  "province",
  "source_name",
  "source_url",
  "seo_title",
  "seo_description",
  "cover_alt",
  "cover_credit",
  "tags",
  "fact_check_notes",
  "notes_for_editor",
] as const;

export type EventCsvHeader = (typeof EVENT_CSV_HEADERS)[number];
export type ArticleCsvHeader = (typeof ARTICLE_CSV_HEADERS)[number];

export type FieldStatus = "detected" | "missing" | "review";

export type PreviewField = {
  key: string;
  label: string;
  value: string;
  status: FieldStatus;
  note?: string;
};

export type AiImportMergeMode = "empty_only" | "replace_all";

export type CategoryOption = { id: string; name: string; slug: string };

/** Valores listos para el formulario de artículo Info Spot. */
export type ArticleFormImportValues = {
  title?: string;
  excerpt?: string;
  content?: string;
  categoryId?: string;
  seoTitle?: string;
  seoDescription?: string;
  sourceName?: string;
  sourceUrl?: string;
  coverCredit?: string;
  /** Notas para el redactor (no campo de form; se muestran en preview). */
  notesForEditor?: string;
  factCheckNotes?: string;
  tags?: string[];
  eventName?: string;
  eventDate?: string;
  city?: string;
  province?: string;
  categoryLabel?: string;
  categoryUnknown?: boolean;
};

/** Valores listos para el formulario de evento Info Spot. */
export type EventFormImportValues = {
  title?: string;
  summary?: string;
  description?: string;
  categoryId?: string;
  startAt?: string;
  endAt?: string;
  venueName?: string;
  address?: string;
  city?: string;
  province?: string;
  organizerName?: string;
  organizerEmail?: string;
  organizerPhone?: string;
  organizerWebsite?: string;
  registrationUrl?: string;
  sourceUrl?: string;
  notesForEditor?: string;
  categoryLabel?: string;
  categoryUnknown?: boolean;
};

export type AiImportParseResult =
  | {
      ok: true;
      context: AiImportContext;
      rawRow: Record<string, string>;
      preview: PreviewField[];
      articleValues?: ArticleFormImportValues;
      eventValues?: EventFormImportValues;
      warnings: string[];
    }
  | {
      ok: false;
      error: string;
      warnings?: string[];
    };

export const AI_IMPORT_MAX_CHARS = 80_000;
