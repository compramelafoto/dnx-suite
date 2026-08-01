/**
 * Presentación administrativa de cronograma / consignas (Etapa 02 Imp. 04).
 * Solo deriva etiquetas; no cambia lógica temporal ni estados persistidos.
 */
import type { PublicStatusTone } from "@/lib/public-ux/status-presentation";

export type TimelineAttention = "ok" | "watch" | "action" | "blocked";

export type TimelineStatusPresentation = {
  key: string;
  label: string;
  description: string;
  tone: PublicStatusTone;
  attention: TimelineAttention;
  nextAction?: string;
  visibleToParticipants?: boolean;
  editable?: boolean;
  isFinal?: boolean;
};

const DEFAULT_TZ = "America/Argentina/Buenos_Aires";

export function formatTimelineDateTime(
  value: Date | string | null | undefined,
  timezone = DEFAULT_TZ,
): string {
  if (value == null || value === "") return "Horario a confirmar";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Horario a confirmar";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

export function formatTimelineDateOnly(
  value: Date | string | null | undefined,
  timezone = DEFAULT_TZ,
): string {
  if (value == null || value === "") return "Fecha a confirmar";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "Fecha a confirmar";
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: timezone,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function presentTimelineVersionStatus(
  status: string | null | undefined,
  opts?: { paused?: boolean },
): TimelineStatusPresentation {
  if (opts?.paused) {
    return {
      key: "paused",
      label: "Pausado",
      description:
        "El cronograma publicado está en pausa de contingencia. Las acciones automáticas pueden quedar detenidas.",
      tone: "warning",
      attention: "action",
      nextAction: "Revisá el motivo de la pausa antes de continuar.",
      visibleToParticipants: false,
      editable: false,
    };
  }
  switch (status) {
    case "ACTIVE":
      return {
        key: "published",
        label: "Cronograma publicado",
        description:
          "Esta versión está en uso. No se edita en el lugar: los cambios se hacen en un borrador nuevo.",
        tone: "success",
        attention: "ok",
        visibleToParticipants: true,
        editable: false,
      };
    case "DRAFT":
      return {
        key: "draft",
        label: "Borrador",
        description:
          "Versión en preparación. Todavía no reemplaza al cronograma publicado.",
        tone: "warning",
        attention: "action",
        nextAction: "Completá las fechas y publicá cuando esté lista.",
        visibleToParticipants: false,
        editable: true,
      };
    default:
      return {
        key: "none",
        label: "Sin cronograma publicado",
        description: "Todavía no hay una versión publicada para esta edición.",
        tone: "warning",
        attention: "action",
        nextAction: "Creá un borrador y publicá el cronograma.",
        visibleToParticipants: false,
        editable: true,
      };
  }
}

export function presentMilestoneStatus(
  status: string | null | undefined,
): TimelineStatusPresentation {
  switch (status) {
    case "OPEN":
      return {
        key: "open",
        label: "En curso",
        description: "Esta actividad está abierta ahora.",
        tone: "success",
        attention: "ok",
        visibleToParticipants: true,
      };
    case "UPCOMING":
      return {
        key: "upcoming",
        label: "Programada",
        description: "Se realizará automáticamente en la fecha y hora indicadas.",
        tone: "info",
        attention: "watch",
        visibleToParticipants: false,
      };
    case "CLOSED":
      return {
        key: "closed",
        label: "Finalizada",
        description: "El período de esta actividad terminó.",
        tone: "neutral",
        attention: "ok",
        isFinal: true,
        visibleToParticipants: false,
      };
    case "RELEASED":
      return {
        key: "released",
        label: "Liberada",
        description: "La actividad ya fue liberada para los participantes.",
        tone: "success",
        attention: "ok",
        visibleToParticipants: true,
      };
    case "PENDING_CONFIG":
      return {
        key: "pending_config",
        label: "Sin horario definido",
        description: "Falta confirmar la fecha y hora de esta actividad.",
        tone: "warning",
        attention: "action",
        nextAction: "Completá el horario en el borrador del cronograma.",
        visibleToParticipants: false,
        editable: true,
      };
    default:
      return {
        key: "unknown",
        label: "Estado de actividad",
        description: "Revisá el detalle de la actividad.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

const EVENT_TYPE_LABELS: Record<string, { label: string; description: string }> = {
  REGISTRATION_OPEN: {
    label: "Apertura de inscripciones",
    description: "Los participantes pueden comenzar a inscribirse.",
  },
  REGISTRATION_CLOSE: {
    label: "Cierre de inscripciones",
    description: "Se dejan de aceptar nuevas inscripciones.",
  },
  ACCREDITATION_OPEN: {
    label: "Apertura de acreditación",
    description: "Comienza la acreditación en sede.",
  },
  ACCREDITATION_CLOSE: {
    label: "Cierre de acreditación",
    description: "Finaliza la ventana de acreditación.",
  },
  MARATHON_START: {
    label: "Inicio del evento",
    description: "Comienza la jornada de Clickatón.",
  },
  PROMPT_RELEASE: {
    label: "Publicación de consigna",
    description: "Se libera una consigna para los participantes.",
  },
  CAPTURE_WINDOW_CLOSE: {
    label: "Cierre de captura",
    description: "Termina el período para capturar fotografías.",
  },
  UPLOAD_WINDOW_OPEN: {
    label: "Apertura de envíos",
    description: "Los participantes pueden comenzar a subir fotografías.",
  },
  UPLOAD_WINDOW_CLOSE: {
    label: "Cierre de envíos",
    description: "Ya no se aceptan nuevas entregas.",
  },
  MARATHON_END: {
    label: "Cierre del evento",
    description: "Finaliza la jornada principal.",
  },
  JUDGING_OPEN: {
    label: "Apertura de evaluación",
    description:
      "Comienza la evaluación artística del jurado. Distinta de la admisión técnica.",
  },
  JUDGING_CLOSE: {
    label: "Cierre de evaluación",
    description:
      "Finaliza el plazo para puntuar. Cerrar evaluaciones no publica resultados.",
  },
  RESULTS_RELEASE: {
    label: "Publicación de resultados",
    description:
      "Los participantes pueden consultar el resultado publicado. Distinto de un ranking preliminar.",
  },
  CUSTOM: {
    label: "Actividad personalizada",
    description: "Actividad definida para esta edición.",
  },
};

export function presentTimelineEventType(eventType: string | null | undefined): {
  label: string;
  description: string;
} {
  if (!eventType) {
    return { label: "Actividad", description: "Actividad del cronograma." };
  }
  return (
    EVENT_TYPE_LABELS[eventType] ?? {
      label: "Actividad",
      description: "Actividad del cronograma.",
    }
  );
}

/**
 * Estado admin de consigna (persistido) + visibilidad operativa.
 */
export function presentAdminPromptStatus(
  status: string | null | undefined,
): TimelineStatusPresentation {
  switch (status) {
    case "DRAFT":
      return {
        key: "draft",
        label: "En preparación",
        description: "Todavía no está visible para los participantes.",
        tone: "warning",
        attention: "action",
        nextAction: "Completá el contenido y dejala lista para programar o publicar.",
        visibleToParticipants: false,
        editable: true,
      };
    case "READY":
      return {
        key: "ready",
        label: "Lista para programar",
        description:
          "El contenido está preparado. Seguirá oculta hasta la apertura programada o una publicación manual.",
        tone: "info",
        attention: "watch",
        nextAction: "Revisá el cronograma o publicá manualmente cuando corresponda.",
        visibleToParticipants: false,
        editable: true,
      };
    case "LOCKED":
      return {
        key: "locked",
        label: "Programada · oculta",
        description:
          "Está preparada para abrirse según el cronograma. Los participantes aún no ven el contenido.",
        tone: "info",
        attention: "watch",
        visibleToParticipants: false,
        editable: true,
      };
    case "RELEASED":
      return {
        key: "released",
        label: "Disponible para participantes",
        description: "Los participantes ya pueden verla y trabajar con ella.",
        tone: "success",
        attention: "ok",
        visibleToParticipants: true,
        editable: false,
      };
    case "CLOSED":
      return {
        key: "closed",
        label: "Finalizada",
        description: "El período para completar esta actividad terminó.",
        tone: "neutral",
        attention: "ok",
        visibleToParticipants: false,
        isFinal: true,
        editable: false,
      };
    case "CANCELLED":
      return {
        key: "cancelled",
        label: "Cancelada",
        description: "Esta consigna no está disponible para los participantes.",
        tone: "danger",
        attention: "blocked",
        visibleToParticipants: false,
        isFinal: true,
        editable: false,
      };
    default:
      return {
        key: "unknown",
        label: "Estado de consigna",
        description: "Revisá el detalle antes de operar.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

export function presentParticipantPromptVisibility(
  publicStatus: string | null | undefined,
): TimelineStatusPresentation {
  switch (publicStatus) {
    case "LOCKED":
      return {
        key: "hidden",
        label: "Oculta para participantes",
        description: "Todavía no pueden ver el contenido de la consigna.",
        tone: "warning",
        attention: "watch",
        visibleToParticipants: false,
      };
    case "RELEASED":
      return {
        key: "visible",
        label: "Visible para participantes",
        description: "Ya pueden ver el título y las indicaciones.",
        tone: "success",
        attention: "ok",
        visibleToParticipants: true,
      };
    case "CLOSED":
      return {
        key: "closed_public",
        label: "Cerrada para nuevas entregas",
        description: "La ventana de esta consigna finalizó o fue cancelada.",
        tone: "neutral",
        attention: "ok",
        visibleToParticipants: false,
        isFinal: true,
      };
    default:
      return {
        key: "unknown_vis",
        label: "Visibilidad a revisar",
        description: "No pudimos determinar qué ven los participantes.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

export function presentAutomationExecutionStatus(
  status: string | null | undefined,
): TimelineStatusPresentation {
  switch (status) {
    case "PENDING":
    case "QUEUED":
    case "WAITING":
    case "SCHEDULED":
      return {
        key: "pending",
        label: "Pendiente de ejecución",
        description: "Se realizará automáticamente en la fecha y hora programadas.",
        tone: "warning",
        attention: "watch",
      };
    case "PROCESSING":
    case "RUNNING":
      return {
        key: "processing",
        label: "Procesando",
        description: "El sistema está realizando esta acción. Puede tardar unos minutos.",
        tone: "info",
        attention: "watch",
      };
    case "COMPLETED":
    case "SUCCESS":
    case "DONE":
      return {
        key: "completed",
        label: "Completado",
        description: "La acción se realizó correctamente.",
        tone: "success",
        attention: "ok",
        isFinal: true,
      };
    case "FAILED":
    case "ERROR":
      return {
        key: "failed",
        label: "No se pudo completar",
        description: "El proceso automático encontró un problema y necesita revisión.",
        tone: "danger",
        attention: "action",
        nextAction: "Revisá la configuración o volvé a intentar si está disponible.",
      };
    default:
      return {
        key: "unknown_auto",
        label: "Acción automática",
        description: "Revisá el detalle del proceso.",
        tone: "neutral",
        attention: "watch",
      };
  }
}

export function presentReleaseMode(mode: string | null | undefined): string {
  switch (mode) {
    case "SCHEDULED":
      return "Publicación automática según cronograma";
    case "MANUAL":
      return "Publicación manual";
    default:
      return "Modo de publicación a confirmar";
  }
}

export function timelineToneToBadgeVariant(
  tone: PublicStatusTone,
): "success" | "warning" | "danger" | "neutral" | "brand" | "accent" {
  if (tone === "info") return "accent";
  return tone;
}

export type TimelineSummaryCounts = {
  draftPrompts: number;
  scheduledPrompts: number;
  releasedPrompts: number;
  closedPrompts: number;
  hasPublishedTimeline: boolean;
  hasDraftTimeline: boolean;
  paused: boolean;
};

export function summarizeTimelineAdmin(input: {
  promptStatuses: string[];
  timelineStatus: string | null;
  hasDraft: boolean;
  paused: boolean;
}): TimelineSummaryCounts {
  const counts: TimelineSummaryCounts = {
    draftPrompts: 0,
    scheduledPrompts: 0,
    releasedPrompts: 0,
    closedPrompts: 0,
    hasPublishedTimeline: input.timelineStatus === "ACTIVE",
    hasDraftTimeline: input.hasDraft,
    paused: input.paused,
  };
  for (const s of input.promptStatuses) {
    if (s === "DRAFT") counts.draftPrompts += 1;
    else if (s === "READY" || s === "LOCKED") counts.scheduledPrompts += 1;
    else if (s === "RELEASED") counts.releasedPrompts += 1;
    else if (s === "CLOSED" || s === "CANCELLED") counts.closedPrompts += 1;
  }
  return counts;
}

export function presentAuditAction(action: string): string {
  const map: Record<string, string> = {
    UPDATE_EVENT: "Actualización de actividad",
    ACTIVATE: "Publicación del cronograma",
    ENSURE_DRAFT: "Creación de borrador",
    PAUSE: "Pausa de contingencia",
    SHIFT_FUTURE: "Reprogramación de actividades futuras",
    RELEASE_PROMPT: "Publicación manual de consigna",
  };
  return map[action] ?? action.replace(/_/g, " ").toLowerCase();
}
