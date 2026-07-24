/**
 * Umbrales y límites configurables del motor (no hardcodear en apps).
 */

export const AUDIENCE_RADIUS_PRESETS_KM = [10, 25, 50, 100] as const;

export type AudienceRadiusPresetKm = (typeof AUDIENCE_RADIUS_PRESETS_KM)[number];

export type AudienceScopeMode =
  | { kind: "RADIUS_KM"; km: number }
  | { kind: "CITY" }
  | { kind: "PROVINCE" };

export const DEFAULT_AUDIENCE_RADIUS_KM: AudienceRadiusPresetKm = 50;

/** Radio personalizado: mínimo / máximo razonables (km). */
export const CUSTOM_RADIUS_LIMITS_KM = {
  min: 1,
  max: 250,
} as const;

export const ANTI_SPAM_DEFAULTS = {
  /** Máximo de campañas confirmadas por convocatoria (mismo ciclo). */
  maxCampaignsPerSourceEntity: 3,
  /** Máximo de campañas confirmadas por editor / día UTC. */
  maxCampaignsPerActorPerDay: 10,
  /** Máximo de avisos similares (mismo eventType) por destinatario en ventana. */
  maxSimilarPerRecipient: 2,
  /** Ventana de cooldown similar (ms). */
  similarCooldownMs: 7 * 24 * 60 * 60 * 1000,
  /** Audiencia máxima por campaña sin autorización reforzada. */
  maxAudienceSoft: 1000,
  /** Tope duro de audiencia por campaña. */
  maxAudienceHard: 5000,
} as const;

export const RETRY_DEFAULTS = {
  maxAttempts: 5,
  /** Backoff base en ms (exponencial: base * 2^(attempt-1)). */
  baseBackoffMs: 30_000,
  maxBackoffMs: 30 * 60 * 1000,
} as const;

export const TEMPLATE_LIMITS = {
  titleMax: 120,
  bodyMax: 800,
  ctaLabelMax: 40,
} as const;
