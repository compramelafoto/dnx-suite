import { getDisplayStatus, type ContestStatus } from "../contest-permissions";

export type CategoryEditMode = "full" | "partial" | "readonly";

/**
 * ¿Se puede reemplazar el listado completo de categorías (wizard / modal legacy)?
 * Solo sin obras ni asignaciones de jurado que referencien categorías del concurso.
 */
export function canBulkReplaceContestCategories(params: {
  contestDbStatus: string;
  entryCount: number;
  assignmentCount: number;
}): boolean {
  const s = getDisplayStatus(params.contestDbStatus);
  if (s === "CLOSED" || s === "ARCHIVED") return false;
  if (params.entryCount > 0 || params.assignmentCount > 0) return false;
  return true;
}

export function getCategoryManagementMode(
  contestDbStatus: string,
  hasEntries: boolean
): CategoryEditMode {
  const s = getDisplayStatus(contestDbStatus) as ContestStatus;
  if (s === "CLOSED" || s === "ARCHIVED") return "readonly";
  if (s === "DRAFT" || s === "READY") return "full";
  if (s === "PUBLISHED") return hasEntries ? "partial" : "full";
  return "readonly";
}

export function canArchiveContestCategory(mode: CategoryEditMode): boolean {
  return mode === "full" || mode === "partial";
}

export function canAddContestCategory(mode: CategoryEditMode): boolean {
  return mode === "full" || mode === "partial";
}

export function canReorderContestCategories(mode: CategoryEditMode): boolean {
  return mode === "full" || mode === "partial";
}

/** Editar nombre/descripcion/maxFiles de una categoría existente. */
export function canEditContestCategoryFields(mode: CategoryEditMode, categoryEntryCount: number): boolean {
  if (mode === "readonly") return false;
  if (mode === "full") return true;
  // partial (publicado con obras): permitir ajustes no estructurales; slug sensible si hay obras
  return categoryEntryCount === 0 || true;
}

export function canChangeContestCategorySlug(mode: CategoryEditMode, categoryEntryCount: number): boolean {
  if (mode === "readonly") return false;
  if (categoryEntryCount > 0) return false;
  return true;
}

export function canEditGlobalMappings(mode: CategoryEditMode): boolean {
  return mode === "full" || mode === "partial";
}
