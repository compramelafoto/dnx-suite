import {
  EDITORIAL_ASSISTANT_STORAGE_KEY,
  EDITORIAL_ASSISTANT_VERSION,
  createEmptyAssistantState,
  type EditorialAssistantState,
} from "./types";

function isBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isValidState(value: unknown): value is EditorialAssistantState {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return v.version === EDITORIAL_ASSISTANT_VERSION && typeof v.updatedAt === "string";
}

export function loadAssistantState(): EditorialAssistantState | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(EDITORIAL_ASSISTANT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveAssistantState(state: EditorialAssistantState): void {
  if (!isBrowser()) return;
  try {
    const next: EditorialAssistantState = {
      ...state,
      updatedAt: new Date().toISOString(),
    };
    window.localStorage.setItem(EDITORIAL_ASSISTANT_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Quota / private mode: el wizard sigue en memoria.
  }
}

export function clearAssistantState(): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.removeItem(EDITORIAL_ASSISTANT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function hasPendingAssistantWork(state: EditorialAssistantState | null): boolean {
  if (!state) return false;
  if (state.articleId) return false;
  return Boolean(
    state.intent ||
      state.event ||
      state.coverages.length > 0 ||
      state.photos.length > 0 ||
      state.draft.title.trim() ||
      state.draft.excerpt.trim(),
  );
}

export function mergeAssistantState(
  base: EditorialAssistantState,
  patch: Partial<EditorialAssistantState>,
): EditorialAssistantState {
  return {
    ...base,
    ...patch,
    draft: patch.draft ? { ...base.draft, ...patch.draft } : base.draft,
    updatedAt: new Date().toISOString(),
  };
}

export { createEmptyAssistantState };
