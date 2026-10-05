/**
 * Las constantes del módulo de Gobierno institucional (proyectos de la comisión directiva).
 *
 * La clave `governance` estaba reservada como `PLANNED` en `lib/modules/registry.ts`, y las
 * plantillas de roles de la comisión ya la nombran (Presidencia y Secretaría gestionan; el resto
 * ve). Diseño: `docs/superpowers/specs/2026-10-03-fotoffice-gobierno-proyectos-design.md`.
 */

export const GOVERNANCE_MODULE_KEY = "governance";

/** Todo lo que se muestra se lee en esta zona; las fechas límite se guardan al mediodía de acá. */
export const GOVERNANCE_TIME_ZONE = "America/Argentina/Buenos_Aires";

/**
 * Los estados del proyecto. Texto y no enum de Prisma, igual que `Raffle.status`: el schema lo
 * comparten varias bases y un enum que falte en alguna rompe sus escrituras.
 */
export const PROJECT_STATUSES = [
  "MEMBER_PROPOSAL",
  "ARCHIVED",
  "PROPOSED",
  "IN_REVIEW",
  "POSTPONED",
  "REJECTED",
  "APPROVED",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_ORIGINS = ["COMMISSION", "MEMBER_PROPOSAL"] as const;
export type ProjectOrigin = (typeof PROJECT_ORIGINS)[number];

export const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "DONE", "NOT_DONE"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export function isProjectStatus(value: string): value is ProjectStatus {
  return (PROJECT_STATUSES as readonly string[]).includes(value);
}

export function isTaskStatus(value: string): value is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(value);
}

/** Cualquier tipo de archivo, hasta 25 MB cada uno (diseño §6). */
export const GOVERNANCE_MAX_FILE_BYTES = 25 * 1024 * 1024;

/** Cuánto vale el enlace firmado de una descarga. Alcanza para abrirlo, no para compartirlo. */
export const GOVERNANCE_DOWNLOAD_SECONDS = 5 * 60;

/** Los tipos de evento del historial (`GovProjectEvent.type`). */
export type ProjectEventType =
  | "CREATED"
  | "UPDATED"
  | "STATUS_CHANGED"
  | "STAGE_ADDED"
  | "STAGE_RENAMED"
  | "STAGE_REMOVED"
  | "TASK_CREATED"
  | "TASK_UPDATED"
  | "TASK_ASSIGNED"
  | "TASK_STATUS"
  | "TASK_PROGRESS"
  | "TASK_REMOVED"
  | "FILE_ADDED"
  | "FILE_VISIBILITY"
  | "NOTE";
