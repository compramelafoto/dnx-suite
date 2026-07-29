/**
 * Contrato del motor de inteligencia editorial (sin LLM).
 */

export type EditorialQualityLevel =
  | "excellent"
  | "good"
  | "fair"
  | "incomplete";

export type SuggestionKind =
  | "quality"
  | "category"
  | "tag"
  | "geo"
  | "seo"
  | "related"
  | "duplicate"
  | "call"
  | "banner"
  | "link"
  | "checklist"
  | "summary";

export type SuggestionSeverity = "info" | "warning" | "success" | "danger";

export type SuggestionActionType =
  | "applyCategory"
  | "applyTag"
  | "openUrl"
  | "noop";

export type EditorialSuggestion = {
  id: string;
  kind: SuggestionKind;
  severity: SuggestionSeverity;
  title: string;
  message: string;
  action?: {
    type: SuggestionActionType;
    payload?: unknown;
  };
  meta?: Record<string, unknown>;
};

export type EditorialCategoryOption = {
  id: string;
  name: string;
  slug: string;
};

export type EditorialRelatedHit = {
  id: string;
  title: string;
  url: string;
  kind: "article" | "event" | "coverage" | "album" | "call" | "category";
  score?: number;
};

export type EditorialDraftSnapshot = {
  title: string;
  excerpt: string;
  content: string;
  slug: string;
  seoTitle: string;
  seoDescription: string;
  categoryId: string | null;
  categorySlug: string | null;
  categoryName: string | null;
  availableCategories: EditorialCategoryOption[];
  geographicScope: string | null;
  countryName: string | null;
  countryCode: string | null;
  province: string | null;
  city: string | null;
  placeName: string | null;
  latitude: number | null;
  longitude: number | null;
  hasCover: boolean;
  hasAuthor: boolean;
  hasSource: boolean;
  publishedAt: string | null;
  /** Prioridad 0–100 si la app la expone. */
  editorialPriority?: number | null;
  /** Tags ya elegidos (InfoSpot aún no persiste tags libres). */
  selectedTags?: string[];
  /** Evento/actividad vinculada (fecha ISO). */
  linkedEventStartsAt?: string | null;
  linkedEventTitle?: string | null;
  hasPhotographerCall?: boolean;
  /** Hits async de la app (duplicados / relacionados). */
  relatedHits?: EditorialRelatedHit[];
  duplicateHits?: EditorialRelatedHit[];
  linkHits?: EditorialRelatedHit[];
};

export type EditorialChecklistItem = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
};

export type EditorialAssistantResult = {
  qualityLevel: EditorialQualityLevel;
  qualityLabel: string;
  score: number;
  completenessPercent: number;
  checklist: EditorialChecklistItem[];
  suggestions: EditorialSuggestion[];
  summary: {
    category: string | null;
    scope: string | null;
    hasCover: boolean;
    locationLabel: string | null;
    seoOk: boolean;
    callSuggested: boolean;
    bannerSuggested: boolean;
    duplicateCount: number;
    relatedCount: number;
    score: number;
  };
  /** Debug: proveedor usado. */
  providerId: string;
};

/**
 * Proveedor desacoplado — hoy reglas; mañana OpenAI/Claude/etc.
 */
export interface EditorialSuggestionProvider {
  readonly id: string;
  analyze(draft: EditorialDraftSnapshot): Promise<EditorialAssistantResult> | EditorialAssistantResult;
}
