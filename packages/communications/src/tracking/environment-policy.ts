import {
  isCommunicationTrackingEventType,
  type CommunicationTrackingEventType,
} from "./events";

export type CommunicationsDeclaredEnvironment =
  | "development"
  | "staging"
  | "production";

/**
 * Política explícita de entorno para webhooks.
 * Los efectos de producto requieren múltiples condiciones futuras — no una sola flag.
 */
export type CommunicationWebhookEnvironmentPolicy = {
  environment: CommunicationsDeclaredEnvironment;
  allowedEvents: readonly CommunicationTrackingEventType[];
  /** false en staging Imp07 — opened/clicked no se persisten. */
  persistBehavioralEvents: boolean;
  /** Siempre false hasta revisión legal + modo process. */
  productEffectsEnabled: boolean;
};

/** Eventos técnicos de entregabilidad (staging Imp07). */
export const STAGING_TECHNICAL_TRACKING_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
] as const satisfies readonly CommunicationTrackingEventType[];

export const BEHAVIORAL_TRACKING_EVENTS = [
  "email.opened",
  "email.clicked",
] as const satisfies readonly CommunicationTrackingEventType[];

export function isBehavioralTrackingEvent(
  type: CommunicationTrackingEventType,
): boolean {
  return (BEHAVIORAL_TRACKING_EVENTS as readonly string[]).includes(type);
}

export type ParseAllowedEventsResult =
  | { ok: true; events: CommunicationTrackingEventType[] }
  | { ok: false; errorMessage: string };

/**
 * Parsea lista CSV de eventos. Dedup. Rechaza vacía / inválida / desconocida.
 */
export function parseAllowedTrackingEvents(
  raw: string | undefined,
): ParseAllowedEventsResult {
  const source =
    raw?.trim() ||
    STAGING_TECHNICAL_TRACKING_EVENTS.join(",");
  const parts = source
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    return { ok: false, errorMessage: "COMMUNICATIONS_WEBHOOK_ALLOWED_EVENTS vacío." };
  }
  const seen = new Set<string>();
  const events: CommunicationTrackingEventType[] = [];
  for (const part of parts) {
    if (seen.has(part)) continue;
    seen.add(part);
    if (!isCommunicationTrackingEventType(part)) {
      return {
        ok: false,
        errorMessage: `Evento no reconocido en allowlist: ${part.slice(0, 40)}`,
      };
    }
    events.push(part);
  }
  return { ok: true, events };
}

export function parseDeclaredEnvironment(
  raw: string | undefined,
): CommunicationsDeclaredEnvironment {
  const v = (raw ?? "development").trim().toLowerCase();
  if (v === "staging" || v === "production" || v === "development") return v;
  return "development";
}

export function createStagingWebhookEnvironmentPolicy(
  allowedEvents: readonly CommunicationTrackingEventType[] = STAGING_TECHNICAL_TRACKING_EVENTS,
): CommunicationWebhookEnvironmentPolicy {
  return {
    environment: "staging",
    allowedEvents: [...allowedEvents],
    persistBehavioralEvents: false,
    productEffectsEnabled: false,
  };
}

export function resolveWebhookEnvironmentPolicy(input: {
  environment: CommunicationsDeclaredEnvironment;
  allowedEvents: readonly CommunicationTrackingEventType[];
  persistBehavioralEvents?: boolean;
  productEffectsEnabled?: boolean;
}): CommunicationWebhookEnvironmentPolicy {
  // Efectos de producto nunca se habilitan con una sola variable en Imp07.
  return {
    environment: input.environment,
    allowedEvents: [...input.allowedEvents],
    persistBehavioralEvents: input.persistBehavioralEvents === true,
    productEffectsEnabled: false,
  };
}

export type EventAdmissionDecision =
  | { admit: true; persist: true }
  | {
      admit: false;
      persist: false;
      errorCode: "WEBHOOK_EVENT_NOT_ALLOWED_IN_ENVIRONMENT";
      reason: string;
    };

/**
 * Decisión server-side: allowlist + bloqueo comportamental.
 */
export function admitTrackingEvent(input: {
  policy: CommunicationWebhookEnvironmentPolicy;
  eventType: CommunicationTrackingEventType;
}): EventAdmissionDecision {
  const { policy, eventType } = input;
  if (isBehavioralTrackingEvent(eventType) && !policy.persistBehavioralEvents) {
    return {
      admit: false,
      persist: false,
      errorCode: "WEBHOOK_EVENT_NOT_ALLOWED_IN_ENVIRONMENT",
      reason: `Evento comportamental bloqueado en ${policy.environment}`,
    };
  }
  if (!policy.allowedEvents.includes(eventType)) {
    return {
      admit: false,
      persist: false,
      errorCode: "WEBHOOK_EVENT_NOT_ALLOWED_IN_ENVIRONMENT",
      reason: `Evento no permitido en ${policy.environment}`,
    };
  }
  return { admit: true, persist: true };
}
