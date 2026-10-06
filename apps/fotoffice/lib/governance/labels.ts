import type { ProjectEventType, ProjectStatus, TaskStatus } from "./constants";
import type { Urgency } from "./urgency";

/**
 * Cómo se nombra cada cosa en pantalla. Módulo PURO.
 */

const ESTADO: Record<ProjectStatus, string> = {
  MEMBER_PROPOSAL: "Propuesta de socio",
  ARCHIVED: "Archivada",
  PROPOSED: "Propuesto",
  IN_REVIEW: "En tratamiento",
  POSTPONED: "Postergado",
  REJECTED: "Rechazado",
  APPROVED: "Aprobado",
  IN_PROGRESS: "En ejecución",
  DONE: "Terminado",
  CANCELLED: "Cancelado",
};

/** El verbo del botón que lleva a cada estado. */
const ACCION: Record<ProjectStatus, string> = {
  MEMBER_PROPOSAL: "Volver a propuesta",
  ARCHIVED: "Archivar",
  PROPOSED: "Aceptar la propuesta",
  IN_REVIEW: "Pasar a tratamiento",
  POSTPONED: "Postergar",
  REJECTED: "Rechazar",
  APPROVED: "Aprobar",
  IN_PROGRESS: "Empezar la ejecución",
  DONE: "Dar por terminado",
  CANCELLED: "Cancelar",
};

const TAREA: Record<TaskStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En curso",
  DONE: "Hecha",
  NOT_DONE: "No se hizo",
};

export function projectStatusLabel(status: string): string {
  return ESTADO[status as ProjectStatus] ?? status;
}

export function projectActionLabel(status: ProjectStatus): string {
  return ACCION[status];
}

export function taskStatusLabel(status: string): string {
  return TAREA[status as TaskStatus] ?? status;
}

/** Color de la pastilla de estado: tokens del sistema de diseño, sin colores sueltos. */
export function projectStatusTone(status: string): "neutral" | "info" | "success" | "warning" | "danger" {
  switch (status) {
    case "APPROVED":
    case "IN_PROGRESS":
      return "info";
    case "DONE":
      return "success";
    case "POSTPONED":
    case "MEMBER_PROPOSAL":
      return "warning";
    case "REJECTED":
    case "CANCELLED":
    case "ARCHIVED":
      return "danger";
    default:
      return "neutral";
  }
}

const URGENCIA: Record<Urgency, string> = {
  red: "Urgente",
  yellow: "Próximo",
  green: "Con tiempo",
  gray: "Sin fecha",
};

export function urgencyLabel(u: Urgency): string {
  return URGENCIA[u];
}

const ZONA = "America/Argentina/Buenos_Aires";

/** "15/10/2026", en hora argentina. */
export function fecha(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

/** "15/10/2026 18:30", en hora argentina y de corrido (sin "p. m."). */
export function fechaHora(date: Date | null | undefined): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function tamanioArchivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

type EventData = Record<string, unknown> | null;

const s = (v: unknown) => (typeof v === "string" ? v : "");

/** Una línea del historial, legible. `data` es lo que guardó la acción al registrar el evento. */
export function describeEvent(type: string, data: EventData): string {
  const d = data ?? {};
  switch (type as ProjectEventType) {
    case "CREATED":
      return d.initialStatus && d.initialStatus !== "PROPOSED"
        ? `Cargó el proyecto como «${projectStatusLabel(s(d.initialStatus))}»`
        : "Creó el proyecto";
    case "UPDATED":
      return Array.isArray(d.fields) && d.fields.length > 0
        ? `Editó ${(d.fields as string[]).join(", ")}`
        : "Editó los datos del proyecto";
    case "STATUS_CHANGED":
      return d.meetingTitle
        ? `Pasó de «${projectStatusLabel(s(d.from))}» a «${projectStatusLabel(s(d.to))}» en «${s(d.meetingTitle)}»`
        : `Pasó de «${projectStatusLabel(s(d.from))}» a «${projectStatusLabel(s(d.to))}»`;
    case "STAGE_ADDED":
      return `Agregó la etapa «${s(d.title)}»`;
    case "STAGE_RENAMED":
      return `Renombró la etapa «${s(d.from)}» como «${s(d.to)}»`;
    case "STAGE_REMOVED":
      return `Quitó la etapa vacía «${s(d.title)}»`;
    case "TASK_CREATED":
      return `Agregó la tarea «${s(d.title)}»`;
    case "TASK_UPDATED":
      return `Editó la tarea «${s(d.title)}»`;
    case "TASK_ASSIGNED":
      if (d.volunteered) return `${s(d.assignee)} se ofreció para «${s(d.title)}»`;
      return d.assignee
        ? `Le asignó «${s(d.title)}» a ${s(d.assignee)}`
        : `Dejó sin responsable la tarea «${s(d.title)}»`;
    case "TASK_STATUS":
      return `Marcó «${s(d.title)}» como ${taskStatusLabel(s(d.to)).toLowerCase()}`;
    case "TASK_PROGRESS":
      return `Contó un avance en «${s(d.title)}»`;
    case "TASK_REMOVED":
      return `Quitó la tarea «${s(d.title)}»`;
    case "FILE_ADDED":
      return `Subió el archivo «${s(d.filename)}»`;
    case "FILE_VISIBILITY":
      return d.visible
        ? `Hizo visible para socios «${s(d.filename)}»`
        : `Dejó como interno «${s(d.filename)}»`;
    case "NOTE":
      return "Dejó una nota";
    case "QUOTE_ADDED":
      return `Cargó la cotización de ${s(d.supplier)} (${s(d.amount)}) para «${s(d.stage)}»`;
    case "QUOTE_STATUS":
      return d.status === "CHOSEN"
        ? `Eligió la cotización de ${s(d.supplier)}`
        : d.status === "DISCARDED"
          ? `Descartó la cotización de ${s(d.supplier)}`
          : `Volvió a considerar la cotización de ${s(d.supplier)}`;
    case "STAGE_ESTIMATE":
      return `Estimó «${s(d.stage)}» en ${s(d.amount) || "sin monto"}`;
    case "RESERVATION":
      return d.release ? `Liberó ${s(d.amount)} de lo reservado` : `Reservó ${s(d.amount)} para el proyecto`;
    case "MOVEMENT_LINKED":
      return d.kind === "INGRESO" ? `Registró un ingreso de ${s(d.amount)} en ${s(d.account)}` : `Registró un gasto de ${s(d.amount)} desde ${s(d.account)}`;
    case "OPENING_SET":
      return `Cargó lo asignado (${s(d.assigned)}) y gastado (${s(d.spent)}) antes de usar el sistema`;
    case "VOTED":
      return d.value === "FOR"
        ? d.changed ? "Cambió su voto: a favor" : "Votó a favor"
        : d.changed ? "Cambió su voto: en contra" : "Votó en contra";
    default:
      return type;
  }
}
