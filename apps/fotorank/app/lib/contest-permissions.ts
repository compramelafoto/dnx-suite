/**
 * Lógica definitiva de estados y permisos de edición de concursos.
 * Fuente centralizada: backend + frontend + UX.
 *
 * Estados válidos: DRAFT | READY | PUBLISHED | CLOSED | ARCHIVED
 * Legacy en DB (SETUP_IN_PROGRESS, ACTIVE) se mapean internamente.
 */

export type ContestStatus =
  | "DRAFT"
  | "READY"
  | "PUBLISHED"
  | "CLOSED"
  | "ARCHIVED";

export type EditPermission = "full" | "partial" | "readonly" | "locked";

export type ValidationMode = "soft" | "hard" | "restrict";

export const STATUS_LABELS: Record<ContestStatus, string> = {
  DRAFT: "Borrador",
  READY: "Listo para publicar",
  PUBLISHED: "Publicado",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

const LEGACY_TO_STATUS: Record<string, ContestStatus> = {
  DRAFT: "DRAFT",
  SETUP_IN_PROGRESS: "DRAFT",
  READY_TO_PUBLISH: "READY",
  PUBLISHED: "PUBLISHED",
  ACTIVE: "PUBLISHED",
  CLOSED: "CLOSED",
  ARCHIVED: "ARCHIVED",
};

export function getDisplayStatus(dbStatus: string): ContestStatus {
  return LEGACY_TO_STATUS[dbStatus] ?? "DRAFT";
}

export function formatDisplayStatus(dbStatus: string): string {
  return STATUS_LABELS[getDisplayStatus(dbStatus)];
}

export function getValidationMode(status: ContestStatus): ValidationMode {
  switch (status) {
    case "DRAFT": return "soft";
    case "READY": return "hard";
    default: return "restrict";
  }
}

export function canEditDatos(status: ContestStatus): boolean {
  return status !== "ARCHIVED";
}

export function getDatosPermission(status: ContestStatus): EditPermission {
  if (["DRAFT","READY","PUBLISHED"].includes(status)) return "full";
  if (status === "CLOSED") return "partial";
  return "locked";
}

export function getDatosRestrictionMessage(status: ContestStatus): string | null {
  if (status === "CLOSED") return "Solo podés editar textos y portada.";
  if (status === "ARCHIVED") return "No se puede editar cuando el concurso está archivado.";
  return null;
}

export function canEditFechas(status: ContestStatus): boolean {
  return ["DRAFT","READY","PUBLISHED"].includes(status);
}

export function getFechasPermission(status: ContestStatus): EditPermission {
  if (["DRAFT","READY"].includes(status)) return "full";
  if (status === "PUBLISHED") return "partial";
  return "locked";
}

export function canEditFutureDatesOnly(status: ContestStatus): boolean {
  return status === "PUBLISHED";
}

export function getFechasRestrictionMessage(status: ContestStatus): string | null {
  if (status === "PUBLISHED") return "Solo podés modificar fechas futuras.";
  if (["CLOSED","ARCHIVED"].includes(status)) return "Las fechas no se pueden editar.";
  return null;
}

export function canEditCategories(status: ContestStatus, hasEntries: boolean): boolean {
  if (["DRAFT","READY"].includes(status)) return true;
  if (status === "PUBLISHED") return !hasEntries;
  return false;
}

export function getCategoriasPermission(status: ContestStatus, hasEntries: boolean): EditPermission {
  if (["DRAFT","READY"].includes(status)) return "full";
  if (status === "PUBLISHED") return hasEntries ? "locked" : "full";
  return "locked";
}

export function getCategoriasRestrictionMessage(status: ContestStatus, hasEntries: boolean): string | null {
  if (status === "PUBLISHED" && hasEntries)
    return "No se pueden editar categorías porque ya hay participaciones cargadas.";
  if (["CLOSED","ARCHIVED"].includes(status))
    return "Las categorías no se pueden editar.";
  return null;
}

export function canEditJurado(status: ContestStatus, hasEvaluationStarted: boolean): boolean {
  if (["DRAFT","READY"].includes(status)) return true;
  if (status === "PUBLISHED") return !hasEvaluationStarted;
  return false;
}

export function getJuradoPermission(status: ContestStatus, hasEvaluationStarted: boolean): EditPermission {
  if (["DRAFT","READY"].includes(status)) return "full";
  if (status === "PUBLISHED") return hasEvaluationStarted ? "locked" : "full";
  return "locked";
}

export function getJuradoRestrictionMessage(status: ContestStatus, hasEvaluationStarted: boolean): string | null {
  if (status === "PUBLISHED" && hasEvaluationStarted)
    return "No se puede editar el jurado porque la evaluación ya comenzó.";
  if (["CLOSED","ARCHIVED"].includes(status))
    return "El jurado no se puede editar.";
  return null;
}

export function canEditParticipaciones(status: ContestStatus, isRegistrationOpen: boolean): boolean {
  if (["DRAFT","READY"].includes(status)) return true;
  if (status === "PUBLISHED") return isRegistrationOpen;
  return false;
}

export function getParticipacionesPermission(status: ContestStatus, isRegistrationOpen: boolean): EditPermission {
  if (["DRAFT","READY"].includes(status)) return "full";
  if (status === "PUBLISHED") return isRegistrationOpen ? "full" : "locked";
  return "locked";
}

export function canEditRanking(status: ContestStatus): boolean {
  return status === "PUBLISHED" || status === "CLOSED";
}

export function getRankingPermission(status: ContestStatus): EditPermission {
  if (["DRAFT","READY"].includes(status)) return "locked";
  if (status === "PUBLISHED") return "partial";
  if (status === "CLOSED") return "full";
  return "readonly";
}

export function canEditDiplomas(status: ContestStatus): boolean {
  return status !== "ARCHIVED";
}

export function getDiplomasPermission(status: ContestStatus): EditPermission {
  if (status === "ARCHIVED") return "partial";
  return "full";
}

export type ContestModuleId =
  | "datos" | "fechas" | "categorias" | "jurado" | "participaciones"
  | "ranking" | "diplomas" | "premios" | "comercializacion" | "bases" | "publicacion";

export type ContestContext = {
  hasEntries?: boolean;
  hasEvaluationStarted?: boolean;
  isRegistrationOpen?: boolean;
};

export function getEditPermission(
  moduleId: ContestModuleId,
  dbStatus: string,
  context?: ContestContext
): EditPermission {
  const status = getDisplayStatus(dbStatus);
  const ctx = context ?? {};
  switch (moduleId) {
    case "datos": return getDatosPermission(status);
    case "fechas": return getFechasPermission(status);
    case "categorias": return getCategoriasPermission(status, ctx.hasEntries ?? false);
    case "jurado": return getJuradoPermission(status, ctx.hasEvaluationStarted ?? false);
    case "participaciones": return getParticipacionesPermission(status, ctx.isRegistrationOpen ?? false);
    case "ranking": return getRankingPermission(status);
    case "diplomas": return getDiplomasPermission(status);
    case "premios": return status === "ARCHIVED" ? "locked" : "full";
    case "comercializacion": return status === "ARCHIVED" ? "locked" : "full";
    case "bases": return status === "ARCHIVED" ? "partial" : "full";
    case "publicacion": return ["PUBLISHED","CLOSED","ARCHIVED"].includes(status) ? "locked" : "full";
    default: return "locked";
  }
}

export function getRestrictionMessage(
  moduleId: ContestModuleId,
  dbStatus: string,
  context?: ContestContext
): string | null {
  const status = getDisplayStatus(dbStatus);
  const ctx = context ?? {};
  switch (moduleId) {
    case "datos": return getDatosRestrictionMessage(status);
    case "fechas": return getFechasRestrictionMessage(status);
    case "categorias": return getCategoriasRestrictionMessage(status, ctx.hasEntries ?? false);
    case "jurado": return getJuradoRestrictionMessage(status, ctx.hasEvaluationStarted ?? false);
    case "participaciones":
      if (status === "PUBLISHED" && !ctx.isRegistrationOpen) return "La inscripción está cerrada.";
      if (["CLOSED","ARCHIVED"].includes(status)) return "Las participaciones no se pueden editar.";
      return null;
    case "ranking":
      if (["DRAFT","READY"].includes(status)) return "El ranking estará disponible después de publicar.";
      if (status === "ARCHIVED") return "Solo lectura.";
      return null;
    case "diplomas":
      if (status === "ARCHIVED") return "Solo lectura o regeneración admin.";
      return null;
    case "premios":
    case "comercializacion":
      if (status === "ARCHIVED") return "No se puede editar cuando está archivado.";
      return null;
    case "bases":
      if (status === "ARCHIVED") return "Solo lectura o regeneración admin.";
      return null;
    case "publicacion":
      if (["PUBLISHED","CLOSED","ARCHIVED"].includes(status))
        return "El concurso ya está publicado o cerrado.";
      return null;
    default: return "Este módulo no se puede editar.";
  }
}

export function canEdit(
  moduleId: ContestModuleId,
  dbStatus: string,
  context?: ContestContext
): boolean {
  const perm = getEditPermission(moduleId, dbStatus, context);
  return perm === "full" || perm === "partial";
}
