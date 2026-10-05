import { isProjectStatus, isTaskStatus, type ProjectStatus, type TaskStatus } from "./constants";
import { canTransition, INITIAL_STATUSES, isCommissionDecision, requiresReason } from "./lifecycle";

/**
 * Los formularios del módulo, parseados.
 *
 * Módulo PURO: recibe un `FormData` y devuelve valores o un motivo en castellano. Las acciones de
 * servidor sólo escriben.
 */

const texto = (fd: FormData, campo: string) => String(fd.get(campo) ?? "").trim();
const opcional = (fd: FormData, campo: string) => texto(fd, campo) || null;

const MAX_TITULO = 160;
const MAX_TEXTO = 10_000;

/**
 * Una fecha sin hora ("2026-10-15") pasa a ser el mediodía de ese día en Argentina.
 *
 * Mediodía y no medianoche a propósito: guardada a las 00:00, cualquier lectura en otro huso la
 * corre al día anterior. A las 12:00 -03:00 hay doce horas de margen para cualquier lado.
 */
export function parseDateOnly(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const fecha = new Date(`${m[1]}-${m[2]}-${m[3]}T12:00:00-03:00`);
  if (Number.isNaN(fecha.getTime())) return null;
  // `new Date` acepta 2026-02-31 y lo corre a marzo: se rechaza en vez de guardar otra fecha.
  const deVuelta = toDateInputValue(fecha);
  return deVuelta === `${m[1]}-${m[2]}-${m[3]}` ? fecha : null;
}

/** El valor para un `<input type="date">`, en hora argentina. */
export function toDateInputValue(date: Date | null | undefined): string {
  if (!date) return "";
  // `en-CA` da AAAA-MM-DD, que es justo lo que espera el input.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

type Resultado<T> = { ok: true; values: T } | { ok: false; error: string };

export type ProjectFormValues = {
  title: string;
  description: string | null;
  responsibleMemberId: string | null;
  deadlineAt: Date | null;
  visibleToMembers: boolean;
};

export function parseProjectForm(fd: FormData): Resultado<ProjectFormValues> {
  const title = texto(fd, "title");
  if (title === "") return { ok: false, error: "Poné un título." };
  if (title.length > MAX_TITULO) return { ok: false, error: "El título es demasiado largo." };
  const description = opcional(fd, "description");
  if (description && description.length > MAX_TEXTO) {
    return { ok: false, error: "La descripción es demasiado larga." };
  }
  const crudaFecha = texto(fd, "deadlineAt");
  const deadlineAt = crudaFecha ? parseDateOnly(crudaFecha) : null;
  if (crudaFecha && !deadlineAt) return { ok: false, error: "La fecha límite no se entiende." };
  return {
    ok: true,
    values: {
      title,
      description,
      responsibleMemberId: opcional(fd, "responsibleMemberId"),
      deadlineAt,
      visibleToMembers: fd.get("visibleToMembers") === "on",
    },
  };
}

export type NewProjectFormValues = ProjectFormValues & {
  typeId: string | null;
  initialStatus: ProjectStatus;
};

export function parseNewProjectForm(fd: FormData): Resultado<NewProjectFormValues> {
  const base = parseProjectForm(fd);
  if (!base.ok) return base;
  const estado = texto(fd, "initialStatus") || "PROPOSED";
  if (!isProjectStatus(estado) || !INITIAL_STATUSES.includes(estado)) {
    return { ok: false, error: "Ese estado inicial no corresponde." };
  }
  return { ok: true, values: { ...base.values, typeId: opcional(fd, "typeId"), initialStatus: estado } };
}

export type StatusChangeValues = {
  to: ProjectStatus;
  reason: string | null;
  decidedOn: Date | null;
  decision: string | null;
};

/**
 * El cambio de estado. Lo que es obligatorio depende del destino (motivo, fecha de la reunión),
 * así que acá se parsea y en `validateStatusChange` se exige.
 */
export function parseStatusChange(fd: FormData): Resultado<StatusChangeValues> {
  const to = texto(fd, "to");
  if (!isProjectStatus(to)) return { ok: false, error: "Ese estado no existe." };
  const crudaFecha = texto(fd, "decidedOn");
  const decidedOn = crudaFecha ? parseDateOnly(crudaFecha) : null;
  if (crudaFecha && !decidedOn) return { ok: false, error: "La fecha de la reunión no se entiende." };
  return {
    ok: true,
    values: { to, reason: opcional(fd, "reason"), decidedOn, decision: opcional(fd, "decision") },
  };
}

/** Lo que exige cada destino: que el paso exista, el motivo y la fecha de la reunión. */
export function validateStatusChange(from: ProjectStatus, v: StatusChangeValues): string | null {
  if (from === v.to) return "El proyecto ya está en ese estado.";
  if (!canTransition(from, v.to)) return "Desde el estado actual no se puede pasar a ése.";
  if (requiresReason(v.to) && !v.reason) return "Escribí el motivo: es lo que se va a leer después.";
  if (isCommissionDecision(v.to) && !v.decidedOn) {
    return "Poné la fecha de la reunión de comisión en que se decidió.";
  }
  return null;
}

export type TaskFormValues = {
  title: string;
  description: string | null;
  assigneeMemberId: string | null;
  dueAt: Date | null;
};

export function parseTaskForm(fd: FormData): Resultado<TaskFormValues> {
  const title = texto(fd, "title");
  if (title === "") return { ok: false, error: "Poné qué hay que hacer." };
  if (title.length > MAX_TITULO) return { ok: false, error: "El título de la tarea es demasiado largo." };
  const description = opcional(fd, "description");
  if (description && description.length > MAX_TEXTO) {
    return { ok: false, error: "La descripción es demasiado larga." };
  }
  const crudaFecha = texto(fd, "dueAt");
  const dueAt = crudaFecha ? parseDateOnly(crudaFecha) : null;
  if (crudaFecha && !dueAt) return { ok: false, error: "La fecha de la tarea no se entiende." };
  return {
    ok: true,
    values: { title, description, assigneeMemberId: opcional(fd, "assigneeMemberId"), dueAt },
  };
}

export function parseTaskStatus(fd: FormData): Resultado<{ status: TaskStatus; reason: string | null }> {
  const status = texto(fd, "status");
  if (!isTaskStatus(status)) return { ok: false, error: "Ese estado de tarea no existe." };
  const reason = opcional(fd, "reason");
  if (status === "NOT_DONE" && !reason) {
    return { ok: false, error: "Contá por qué no se hizo: es lo que se va a leer después." };
  }
  return { ok: true, values: { status, reason } };
}

export function parseStageTitle(fd: FormData): Resultado<{ title: string }> {
  const title = texto(fd, "title");
  if (title === "") return { ok: false, error: "Poné el nombre de la etapa." };
  if (title.length > MAX_TITULO) return { ok: false, error: "El nombre de la etapa es demasiado largo." };
  return { ok: true, values: { title } };
}

export function parseProgressNote(fd: FormData): Resultado<{ body: string }> {
  const body = texto(fd, "body");
  if (body === "") return { ok: false, error: "Escribí qué se hizo." };
  if (body.length > MAX_TEXTO) return { ok: false, error: "El texto es demasiado largo." };
  return { ok: true, values: { body } };
}
