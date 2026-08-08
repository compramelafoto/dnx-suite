export type PhotoPromptStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "APPROVED"
  | "REJECTED"
  | "ARCHIVED";

/** Alias usado por UI / docs. */
export type PhotoPromptLibraryStatus = PhotoPromptStatus;

export const PHOTO_PROMPT_LIBRARY_STATUSES = [
  "DRAFT",
  "IN_REVIEW",
  "APPROVED",
  "REJECTED",
  "ARCHIVED",
] as const satisfies readonly PhotoPromptStatus[];

export type PhotoPromptInspirationType =
  | "DIRECTOR"
  | "MOVIE"
  | "GENRE"
  | "ART_MOVEMENT"
  | "PHOTOGRAPHER"
  | "VISUAL_STYLE"
  | "OTHER";

export const PHOTO_PROMPT_INSPIRATION_TYPES = [
  "DIRECTOR",
  "MOVIE",
  "GENRE",
  "ART_MOVEMENT",
  "PHOTOGRAPHER",
  "VISUAL_STYLE",
  "OTHER",
] as const satisfies readonly PhotoPromptInspirationType[];

export type PhotoPromptDifficulty = "EASY" | "MEDIUM" | "HARD";

export const PHOTO_PROMPT_DIFFICULTIES = [
  "EASY",
  "MEDIUM",
  "HARD",
] as const satisfies readonly PhotoPromptDifficulty[];

export type PhotoPromptLibraryAuditAction =
  | "CREATE"
  | "UPDATE"
  | "SUBMIT_REVIEW"
  | "APPROVE"
  | "REJECT"
  | "ARCHIVE"
  | "RESTORE"
  | "ASSIGN"
  | "UNASSIGN"
  | "REORDER"
  | "IMPORT"
  | "DUPLICATE";

export const MAX_PROMPTS_PER_EDITION = 10;
export const INITIAL_SOURCE_PREFIX = "INITIAL_DNX_PROMPT_LIBRARY_2026";

export type InspirationInput = {
  type?: PhotoPromptInspirationType | null;
  label?: string | null;
  notes?: string | null;
};

export type ListItemsFilters = {
  text?: string;
  themeId?: string;
  subthemeId?: string;
  status?: PhotoPromptStatus | PhotoPromptStatus[];
  difficulty?: PhotoPromptDifficulty | PhotoPromptDifficulty[];
  language?: string;
  universal?: boolean;
  inspirationType?: PhotoPromptInspirationType | PhotoPromptInspirationType[];
  neverUsed?: boolean;
  usageMin?: number;
  usageMax?: number;
  recentlyUsedDays?: number;
  take?: number;
  skip?: number;
};

export type CreateLibraryItemInput = {
  title: string;
  description: string;
  themeId: string;
  subthemeId?: string | null;
  inspirationType?: PhotoPromptInspirationType | null;
  inspirationLabel?: string | null;
  inspirationNotes?: string | null;
  tags?: string[];
  difficulty?: PhotoPromptDifficulty;
  language?: string;
  universal?: boolean;
  sourceKey?: string | null;
  metadataJson?: unknown;
  createdByUserId?: number | null;
};

export type UpdateLibraryItemInput = {
  title?: string;
  description?: string;
  themeId?: string;
  subthemeId?: string | null;
  inspirationType?: PhotoPromptInspirationType | null;
  inspirationLabel?: string | null;
  inspirationNotes?: string | null;
  tags?: string[];
  difficulty?: PhotoPromptDifficulty;
  language?: string;
  universal?: boolean;
  metadataJson?: unknown;
  changeSummary?: string | null;
  actorUserId?: number | null;
};

export type AssignToEditionInput = {
  editionId: string;
  libraryItemId: string;
  sequence?: number;
  actorUserId?: number | null;
  allowDraftForOpsTest?: boolean;
};

export type ImportRow = {
  title: string;
  description: string;
  themeSlug: string;
  subthemeSlug?: string | null;
  tags: string[];
  difficulty: PhotoPromptDifficulty;
  language: string;
  universal: boolean;
  inspirationType?: PhotoPromptInspirationType | null;
  inspirationLabel?: string | null;
  inspirationNotes?: string | null;
  sourceKey?: string | null;
};

export type LibraryKpis = {
  total: number;
  draft: number;
  inReview: number;
  approved: number;
  rejected: number;
  archived: number;
  used: number;
  neverUsed: number;
};

export type AssignmentSnapshot = {
  libraryItemId: string;
  libraryVersion: number;
  titleSnapshot: string;
  descriptionSnapshot: string;
  themeSnapshot: string;
  subthemeSnapshot: string | null;
  inspirationSnapshot: {
    type: PhotoPromptInspirationType | null;
    label: string | null;
    notes: string | null;
  };
};
