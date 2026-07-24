import type {
  ConsentState,
  NotificationChannel,
  PhotographerAudienceInput,
} from "./contracts";

/**
 * Preferencias de comunicación del fotógrafo (contrato).
 * Persistencia vive en apps/DB; aquí solo resolución de política.
 */
export type NotificationPreferenceSnapshot = {
  nearbyPhotographerCalls: boolean;
  cityEvents: boolean;
  callReminders: boolean;
  courses: boolean;
  contests: boolean;
  /** Canales opt-in. IN_APP puede ser operativo sin marketing. */
  channels: {
    inApp: boolean;
    email: boolean;
    webPush: boolean;
  };
  preferredRadiusKm: number | null;
  useProfileLocation: boolean;
  manualCity: string | null;
  frequency: "IMMEDIATE" | "DIGEST";
  /** Consentimiento verificable para canales externos / marketing. */
  externalMarketingConsentAt: Date | string | null;
};

/**
 * Política de compatibilidad para usuarios existentes:
 * - Sin preferencia explícita: in-app operativo ON (no marketing).
 * - Email / push: OFF hasta consentimiento verificable.
 */
export function defaultPreferenceForLegacyUser(): NotificationPreferenceSnapshot {
  return {
    nearbyPhotographerCalls: true,
    cityEvents: false,
    callReminders: false,
    courses: false,
    contests: false,
    channels: {
      inApp: true,
      email: false,
      webPush: false,
    },
    preferredRadiusKm: null,
    useProfileLocation: true,
    manualCity: null,
    frequency: "IMMEDIATE",
    externalMarketingConsentAt: null,
  };
}

export function resolveAvailableChannels(
  pref: NotificationPreferenceSnapshot | null | undefined,
  options?: { emailInfrastructureReady?: boolean },
): NotificationChannel[] {
  const p = pref ?? defaultPreferenceForLegacyUser();
  const channels: NotificationChannel[] = [];
  if (p.channels.inApp) channels.push("IN_APP");
  // EMAIL: opt-in explícito (channelEmail). Consentimiento = channelEmail true
  // (se setea al activar en UI). Infra: EmailQueue/Resend debe estar lista.
  if (p.channels.email && options?.emailInfrastructureReady !== false) {
    channels.push("EMAIL");
  }
  return channels;
}

export function resolveConsentState(
  photographer: Pick<PhotographerAudienceInput, "nearbyCallsEnabled" | "blocked">,
): ConsentState {
  if (photographer.blocked) return "BLOCKED";
  if (photographer.nearbyCallsEnabled === false) return "OPTED_OUT";
  if (photographer.nearbyCallsEnabled == null) return "IN_APP_OK";
  return "IN_APP_OK";
}

/** Fusiona preferencia DNX + notifyCalls legado InfoSpot (si existe). */
export function mergeNearbyCallsPreference(input: {
  dnxNearbyCalls?: boolean | null;
  infoSpotNotifyCalls?: boolean | null;
}): boolean {
  // Opt-out explícito gana.
  if (input.dnxNearbyCalls === false) return false;
  if (input.infoSpotNotifyCalls === false && input.dnxNearbyCalls == null) {
    // InfoSpot notifyCalls=false es opt-in legacy (default false): no bloquear in-app operativo
    // salvo que el usuario haya configurado preferencias InfoSpot con consent.
    return true;
  }
  if (input.dnxNearbyCalls === true) return true;
  return true;
}
