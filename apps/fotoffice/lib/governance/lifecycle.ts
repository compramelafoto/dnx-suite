import type { ProjectStatus, TaskStatus } from "./constants";

/**
 * Por dónde puede moverse un proyecto (diseño §5.2).
 *
 * Módulo PURO. Las acciones de servidor preguntan acá antes de escribir; la pantalla pregunta lo
 * mismo para ofrecer sólo los botones que van a funcionar.
 *
 * ```
 * Propuesta de socio ──(se acepta)──► Propuesto
 *         └──(se archiva, con motivo)──► Archivada
 *
 * Propuesto ──► En tratamiento ──► Aprobado ──► En ejecución ──► Terminado
 *                     ├──► Postergado (vuelve a En tratamiento)
 *                     └──► Rechazado
 * Cualquier estado activo ──► Cancelado (con motivo)
 * ```
 *
 * Aprobar, rechazar o postergar es una decisión de la comisión: exige decir en qué reunión se
 * tomó. Hasta que existan las Reuniones (etapa 2) se escribe la fecha y lo decidido; después se
 * elige la reunión.
 */

const TRANSICIONES: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  MEMBER_PROPOSAL: ["PROPOSED", "ARCHIVED"],
  ARCHIVED: [],
  PROPOSED: ["IN_REVIEW", "APPROVED", "POSTPONED", "REJECTED", "CANCELLED"],
  IN_REVIEW: ["APPROVED", "POSTPONED", "REJECTED", "CANCELLED"],
  POSTPONED: ["IN_REVIEW", "APPROVED", "REJECTED", "CANCELLED"],
  REJECTED: [],
  APPROVED: ["IN_PROGRESS", "DONE", "CANCELLED"],
  IN_PROGRESS: ["DONE", "CANCELLED"],
  DONE: [],
  CANCELLED: [],
};

export function nextStatuses(from: ProjectStatus): readonly ProjectStatus[] {
  return TRANSICIONES[from] ?? [];
}

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
  return nextStatuses(from).includes(to);
}

/** Decisiones que se toman en reunión de comisión: piden fecha y texto de lo decidido. */
const DECISIONES: ReadonlySet<ProjectStatus> = new Set(["APPROVED", "REJECTED", "POSTPONED"]);

export function isCommissionDecision(to: ProjectStatus): boolean {
  return DECISIONES.has(to);
}

/** Archivar, rechazar y cancelar exigen motivo: sin eso no se entiende meses después. */
const CON_MOTIVO: ReadonlySet<ProjectStatus> = new Set(["ARCHIVED", "REJECTED", "CANCELLED"]);

export function requiresReason(to: ProjectStatus): boolean {
  return CON_MOTIVO.has(to);
}

/** Estados donde el proyecto ya no se mueve. */
const CERRADOS: ReadonlySet<ProjectStatus> = new Set(["ARCHIVED", "REJECTED", "DONE", "CANCELLED"]);

export function isClosed(status: ProjectStatus): boolean {
  return CERRADOS.has(status);
}

/** Etapas y tareas se cargan desde que es Propuesto: sirven para presentar el proyecto. */
export function canEditStructure(status: ProjectStatus): boolean {
  return !isClosed(status) && status !== "MEMBER_PROPOSAL";
}

/** Una tarea sólo se da por hecha (o no hecha) cuando el proyecto ya está aprobado. */
export function canCloseTasks(status: ProjectStatus): boolean {
  return status === "APPROVED" || status === "IN_PROGRESS";
}

/** A qué estado puede pasar una tarea, según el estado del proyecto. */
export function allowedTaskStatuses(projectStatus: ProjectStatus): readonly TaskStatus[] {
  if (canCloseTasks(projectStatus)) return ["PENDING", "IN_PROGRESS", "DONE", "NOT_DONE"];
  if (canEditStructure(projectStatus)) return ["PENDING", "IN_PROGRESS"];
  return [];
}

/**
 * Con qué estado se puede cargar un proyecto nuevo.
 *
 * Además de "Propuesto", la comisión necesita cargar los proyectos que ya estaban aprobados o en
 * marcha antes de usar el sistema (diseño §16, etapa 5): no tiene sentido hacerlos pasar de nuevo
 * por la votación.
 */
export const INITIAL_STATUSES: readonly ProjectStatus[] = ["PROPOSED", "APPROVED", "IN_PROGRESS"];
