/**
 * Contratos genéricos del DNX Notifications Engine.
 * Independientes de Prisma / Next / proveedores.
 */

import type { AudienceScopeMode } from "./config";

export const NOTIFICATION_EVENT_TYPES = [
  "CLF_PHOTOGRAPHER_CALL_OPENED",
  "CLF_PHOTOGRAPHER_CALL_UPDATED",
  "CLF_PHOTOGRAPHER_CALL_CLOSING_SOON",
  "INFOSPOT_LOCAL_ALERT_PUBLISHED",
  "CLICKATON_REGISTRATION_OPENED",
  "FOTORANK_CONTEST_OPENED",
  "FOTOOFFICE_COURSE_PUBLISHED",
] as const;

export type NotificationEventType = (typeof NOTIFICATION_EVENT_TYPES)[number];

export function isNotificationEventType(value: string): value is NotificationEventType {
  return (NOTIFICATION_EVENT_TYPES as readonly string[]).includes(value);
}

/** Canales soportados a nivel contrato. Solo implementar los que tengan infra real. */
export const NOTIFICATION_CHANNELS = [
  "IN_APP",
  "EMAIL",
  "WEB_PUSH",
  "TELEGRAM",
  "WHATSAPP",
  "SMS",
] as const;

export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

/** Canales con infraestructura real en el monorepo hoy. */
export const IMPLEMENTED_CHANNELS: readonly NotificationChannel[] = ["IN_APP", "EMAIL"] as const;

export type RecipientKind =
  | "USER"
  | "PHOTOGRAPHER"
  | "ORGANIZER"
  | "ADMIN"
  | "CLIENT"
  | "PARTICIPANT"
  | "UNREGISTERED";

export type ConsentState =
  | "UNKNOWN"
  | "IN_APP_OK"
  | "MARKETING_OK"
  | "OPTED_OUT"
  | "BLOCKED";

export type EligibilityState =
  | "ELIGIBLE"
  | "OUT_OF_RADIUS"
  | "INACTIVE"
  | "BLOCKED"
  | "PREF_DISABLED"
  | "NO_CHANNEL"
  | "ALREADY_APPLIED"
  | "DUPLICATE"
  | "CALL_CLOSED"
  | "CALL_EXPIRED"
  | "INVALID_LOCATION"
  | "ANTI_SPAM";

export type DeliveryStatus =
  | "PENDING"
  | "PROCESSING"
  | "SENT"
  | "FAILED"
  | "DEAD_LETTER"
  | "CANCELLED";

export type DedupState = "NEW" | "DUPLICATE" | "RETRY_SAME";

/**
 * Hecho de dominio que puede originar notificaciones.
 * Idempotencia: `idempotencyKey` debe ser estable por apertura/ciclo.
 */
export type NotificationEvent = {
  type: NotificationEventType;
  /** Clave única del hecho (p. ej. callId + OPENED + cycle). */
  idempotencyKey: string;
  sourceApp: string;
  sourceEntityType: string;
  sourceEntityId: string;
  occurredAt: Date | string;
  payload: Record<string, unknown>;
};

export type NotificationRecipient = {
  kind: RecipientKind;
  userId?: number | string | null;
  photographerProfileId?: string | null;
  externalRef?: string | null;
  displayLabel?: string | null;
};

export type NotificationCandidate = {
  recipient: NotificationRecipient;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  selectionReason: string;
  score: number;
  distanceKm: number | null;
  city: string | null;
  province: string | null;
  consent: ConsentState;
  dedup: DedupState;
  eligibility: EligibilityState;
  excludeReason?: string | null;
};

export type NotificationDeliveryPlan = {
  recipient: NotificationRecipient;
  channel: NotificationChannel;
  status: DeliveryStatus;
  attempts: number;
  error?: string | null;
  scheduledAt?: Date | string | null;
  sentAt?: Date | string | null;
  deliveredAt?: Date | string | null;
  readAt?: Date | string | null;
  clickedAt?: Date | string | null;
  dedupeKey: string;
  title: string;
  body: string;
  ctaUrl: string;
  ctaLabel: string;
};

export type PhotographerAudienceInput = {
  userId: number;
  kind?: RecipientKind;
  active: boolean;
  blocked: boolean;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  province: string | null;
  /** Preferencia: recibir convocatorias cercanas (in-app). Default operativo true si null. */
  nearbyCallsEnabled: boolean | null;
  /** Canales que el usuario permite / tiene. */
  availableChannels: NotificationChannel[];
  /** Ya se postuló a esta convocatoria. */
  alreadyApplied?: boolean;
  /** Claves de dedupe ya existentes para este destinatario+evento+canal. */
  existingDedupeKeys?: string[];
  /** Avisos similares recientes (mismo eventType) en ventana anti-spam. */
  recentSimilarCount?: number;
};

export type CallAudienceContext = {
  eventType: NotificationEventType;
  sourceEntityId: string;
  /** Ciclo de envío (reapertura / nueva campaña manual). */
  campaignCycle: string;
  origin: {
    latitude: number | null;
    longitude: number | null;
    city: string | null;
    province: string | null;
  };
  scope: AudienceScopeMode;
  channels: NotificationChannel[];
  callOpen: boolean;
  callExpired: boolean;
  now?: Date;
};

export type AudienceBucketCounts = {
  found: number;
  eligible: number;
  excluded: number;
  outOfRadius: number;
  prefDisabled: number;
  noChannel: number;
  blockedOrInactive: number;
  alreadyApplied: number;
  duplicates: number;
  invalidLocation: number;
  antiSpam: number;
};

export type AudiencePreview = {
  buckets: AudienceBucketCounts;
  byDistanceKm: Record<string, number>;
  byCity: Record<string, number>;
  eligible: NotificationCandidate[];
  excluded: NotificationCandidate[];
  scopeLabel: string;
};
