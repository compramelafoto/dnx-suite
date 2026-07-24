import {
  isNotificationEventType,
  type NotificationEvent,
  type NotificationEventType,
} from "./contracts";

/**
 * Construye la clave de idempotencia del hecho (no de la campaña de envío).
 * Abrir la misma convocatoria no debe emitir el evento más de una vez por ciclo.
 */
export function buildEventIdempotencyKey(input: {
  type: NotificationEventType;
  sourceEntityType: string;
  sourceEntityId: string;
  cycle?: string;
}): string {
  const cycle = input.cycle?.trim() || "default";
  return `${input.type}:${input.sourceEntityType}:${input.sourceEntityId}:${cycle}`;
}

export function createNotificationEvent(input: {
  type: NotificationEventType | string;
  sourceApp: string;
  sourceEntityType: string;
  sourceEntityId: string;
  occurredAt?: Date | string;
  cycle?: string;
  payload?: Record<string, unknown>;
  idempotencyKey?: string;
}): NotificationEvent {
  if (!isNotificationEventType(input.type)) {
    throw new Error(`Tipo de evento de notificación no soportado: ${input.type}`);
  }
  const type = input.type;
  const idempotencyKey =
    input.idempotencyKey ??
    buildEventIdempotencyKey({
      type,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      cycle: input.cycle,
    });

  return {
    type,
    idempotencyKey,
    sourceApp: input.sourceApp,
    sourceEntityType: input.sourceEntityType,
    sourceEntityId: input.sourceEntityId,
    occurredAt: input.occurredAt ?? new Date(),
    payload: input.payload ?? {},
  };
}

/**
 * Decide si un cambio de estado de convocatoria CLF debe emitir CLF_PHOTOGRAPHER_CALL_OPENED.
 * Abrir ≠ enviar campaña.
 */
export function shouldEmitPhotographerCallOpened(input: {
  previousProvisioningStatus: string | null | undefined;
  nextProvisioningStatus: string;
  enabled: boolean;
  visibility: string;
  joinPolicy: string;
  desiredClfStatus: string;
  clfEventId: number | null | undefined;
  maxPhotographers?: number | null;
  eventCancelled?: boolean;
  missingRequiredData?: boolean;
}): boolean {
  if (input.eventCancelled) return false;
  if (input.missingRequiredData) return false;
  if (!input.enabled) return false;
  if (input.nextProvisioningStatus !== "PROVISIONED") return false;
  if (input.desiredClfStatus !== "ACTIVE") return false;
  if (!input.clfEventId) return false;
  if (input.visibility === "PRIVATE") return false;
  if (input.joinPolicy === "INVITE_ONLY") return false;
  // maxPhotographers === 0 no tiene sentido; null = ilimitado OK
  if (input.maxPhotographers === 0) return false;

  const prev = input.previousProvisioningStatus ?? "NOT_REQUESTED";
  // Solo la transición a abierto (o primer provisionamiento abierto).
  if (prev === "PROVISIONED") return false;
  return true;
}

/** Eventos preparados (contratos) — no implementar campañas completas aún. */
export const FUTURE_EVENT_HOOKS: readonly NotificationEventType[] = [
  "INFOSPOT_LOCAL_ALERT_PUBLISHED",
  "CLICKATON_REGISTRATION_OPENED",
  "FOTORANK_CONTEST_OPENED",
  "FOTOOFFICE_COURSE_PUBLISHED",
  "CLF_PHOTOGRAPHER_CALL_CLOSING_SOON",
] as const;
