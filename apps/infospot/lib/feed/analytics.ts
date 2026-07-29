/**
 * Eventos de analítica no sensibles (sin coordenadas).
 */

export type FeedAnalyticsEvent =
  | "location_prompt_shown"
  | "location_permission_requested"
  | "location_permission_granted"
  | "location_permission_denied"
  | "manual_location_selected"
  | "feed_personalized_loaded"
  | "location_preference_cleared";

type AnalyticsPayload = {
  locationMode?: string;
  permissionState?: string;
  city?: string;
};

/**
 * Emite un evento de producto sin lat/lng ni dirección precisa.
 * Si no hay proveedor, no-op seguro.
 */
export function trackFeedAnalytics(
  event: FeedAnalyticsEvent,
  payload: AnalyticsPayload = {},
): void {
  if (typeof window === "undefined") return;
  try {
    const safe = {
      event,
      ...payload,
      // Garantía: nunca adjuntar coordenadas.
    };
    const w = window as Window & {
      dataLayer?: unknown[];
      gtag?: (...args: unknown[]) => void;
    };
    if (typeof w.gtag === "function") {
      w.gtag("event", event, {
        location_mode: payload.locationMode,
        permission_state: payload.permissionState,
        city: payload.city,
      });
      return;
    }
    if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push(safe);
    }
  } catch {
    // No bloquear UX por analítica.
  }
}
