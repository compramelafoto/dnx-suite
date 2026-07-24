/**
 * Estados visibles de convocatoria en el editor (capa de presentación).
 * No reemplaza `provisioningStatus` persistido; lo traduce a copy editorial.
 */

export type PhotographerCallDisplayStatus =
  | "NONE"
  | "DRAFT_CLF"
  | "PENDING_DATA"
  | "OPEN"
  | "CLOSED"
  | "FINISHED"
  | "SYNC_ERROR";

export type PhotographerCallDisplay = {
  status: PhotographerCallDisplayStatus;
  label: string;
  description: string;
  tone: "neutral" | "warning" | "success" | "danger" | "info";
};

const LABELS: Record<PhotographerCallDisplayStatus, PhotographerCallDisplay> = {
  NONE: {
    status: "NONE",
    label: "Sin convocatoria",
    description: "Esta actividad existe solo en InfoSpot. No hay evento operativo en CLF.",
    tone: "neutral",
  },
  DRAFT_CLF: {
    status: "DRAFT_CLF",
    label: "Borrador en CLF",
    description: "Hay un evento vinculado en ComprameLaFoto; la convocatoria aún no está abierta.",
    tone: "info",
  },
  PENDING_DATA: {
    status: "PENDING_DATA",
    label: "Pendiente de datos",
    description: "Faltan datos (georreferencia, organizador u otros) para crear o abrir la convocatoria.",
    tone: "warning",
  },
  OPEN: {
    status: "OPEN",
    label: "Abierta",
    description: "La convocatoria está pública y abierta en CLF. La inscripción ocurre allí.",
    tone: "success",
  },
  CLOSED: {
    status: "CLOSED",
    label: "Cerrada",
    description: "La convocatoria está cerrada. No acepta nuevas inscripciones.",
    tone: "neutral",
  },
  FINISHED: {
    status: "FINISHED",
    label: "Finalizada",
    description: "El evento ya ocurrió o la convocatoria quedó finalizada.",
    tone: "neutral",
  },
  SYNC_ERROR: {
    status: "SYNC_ERROR",
    label: "Error de sincronización",
    description: "No se pudo sincronizar con CLF. Podés reintentar sin perder la nota.",
    tone: "danger",
  },
};

export function resolvePhotographerCallDisplay(input: {
  enabled?: boolean | null;
  provisioningStatus?: string | null;
  desiredClfStatus?: string | null;
  clfEventId?: number | null;
  publicUrl?: string | null;
  missingGeoref?: boolean;
  eventEnded?: boolean;
}): PhotographerCallDisplay {
  const enabled = Boolean(input.enabled);
  const status = input.provisioningStatus ?? "NOT_REQUESTED";
  const desired = input.desiredClfStatus ?? "ACTIVE";
  const hasClf = Boolean(input.clfEventId || input.publicUrl);

  if (input.eventEnded && (status === "PROVISIONED" || status === "CLOSED")) {
    return LABELS.FINISHED;
  }

  if (!enabled && status === "NOT_REQUESTED") {
    return LABELS.NONE;
  }

  if (status === "FAILED") {
    return LABELS.SYNC_ERROR;
  }

  if (status === "CLOSED" || (status === "PROVISIONED" && desired === "CLOSED")) {
    return LABELS.CLOSED;
  }

  if (status === "BLOCKED" || input.missingGeoref) {
    return LABELS.PENDING_DATA;
  }

  if (status === "PENDING" || status === "PROVISIONING") {
    if (!hasClf) {
      return enabled ? LABELS.PENDING_DATA : LABELS.NONE;
    }
    return LABELS.DRAFT_CLF;
  }

  if (status === "PROVISIONED") {
    if (desired === "ACTIVE") {
      return LABELS.OPEN;
    }
    return LABELS.DRAFT_CLF;
  }

  if (enabled && !hasClf) {
    return LABELS.PENDING_DATA;
  }

  if (!enabled) {
    return LABELS.NONE;
  }

  return LABELS.NONE;
}
