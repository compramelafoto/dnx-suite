/**
 * Estado del Asistente Editorial (cliente).
 * Sin cambios de schema: persiste en localStorage hasta el commit.
 */

export const EDITORIAL_ASSISTANT_STORAGE_KEY = "infospot-editorial-assistant-v1";
export const EDITORIAL_ASSISTANT_VERSION = 1 as const;

export type AssistantIntent =
  | "event"
  | "coverage"
  | "independent"
  | "gallery"
  | "pending";

export type AssistantStepId =
  | "intent"
  | "event"
  | "material"
  | "photos"
  | "draft"
  | "summary";

export type StoryType =
  | "cobertura"
  | "cronica"
  | "previa"
  | "resultados"
  | "comunicado"
  | "galeria"
  | "entrevista"
  | "otro";

export type PhotoRole = "COVER" | "GALLERY" | "INLINE";

export type SelectedPhoto = {
  clfPhotoId: number;
  albumId: number;
  coverageId?: string;
  thumbApiPath: string;
  photographerName: string;
  role: PhotoRole;
};

export type SelectedCoverage = {
  id: string;
  title: string;
  eventTitle: string | null;
  city: string | null;
  photoCount: number;
  commercialStatus: string;
  coverThumbnailUrl: string | null;
  clfAlbumId: number;
  clfEventId: number | null;
  photographerNames: string[];
  lastSyncedAt: string | null;
};

export type SelectedEvent = {
  id: number;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  city: string | null;
  statusLabel: string;
  coverageCount: number;
  photographerCount: number;
  photoCount: number;
  coverThumbnailUrl: string | null;
  categoryHint: string | null;
};

export type AssistantDraftFields = {
  title: string;
  excerpt: string;
  authorByline: string;
  storyType: StoryType | null;
};

export type EditorialAssistantState = {
  version: typeof EDITORIAL_ASSISTANT_VERSION;
  updatedAt: string;
  step: AssistantStepId;
  intent: AssistantIntent | null;
  event: SelectedEvent | null;
  coverages: SelectedCoverage[];
  photos: SelectedPhoto[];
  draft: AssistantDraftFields;
  /** Si se abrió desde un artículo existente (solo selector). */
  existingArticleId: string | null;
  /** Tras commit exitoso. */
  articleId: string | null;
};

export function createEmptyAssistantState(
  partial?: Partial<EditorialAssistantState>,
): EditorialAssistantState {
  return {
    version: EDITORIAL_ASSISTANT_VERSION,
    updatedAt: new Date().toISOString(),
    step: "intent",
    intent: null,
    event: null,
    coverages: [],
    photos: [],
    draft: {
      title: "",
      excerpt: "",
      authorByline: "",
      storyType: null,
    },
    existingArticleId: null,
    articleId: null,
    ...partial,
  };
}

/** View model serializable para SSR → cliente. */
export type AssistantCoverageCard = {
  id: string;
  title: string;
  eventTitle: string | null;
  city: string | null;
  photoCount: number;
  commercialStatus: string;
  coverThumbnailUrl: string | null;
  clfAlbumId: number;
  clfEventId: number | null;
  photographerNames: string[];
  lastSyncedAt: string | null;
};

export type AssistantEventCard = {
  id: number;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  city: string | null;
  statusLabel: string;
  coverageCount: number;
  photographerCount: number;
  photoCount: number;
  coverThumbnailUrl: string | null;
  categoryHint: string | null;
};

export type AssistantBootstrap = {
  coverages: AssistantCoverageCard[];
  events: AssistantEventCard[];
  authorDefault: string;
  categories: { id: string; name: string }[];
};
