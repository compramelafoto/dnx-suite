/**
 * Frecuencia local first-party para activación destacada.
 * Solo localStorage en cliente; SSR-safe; sin PII ni cookies.
 */

export const PARTNER_WELCOME_FREQUENCY_STORAGE_VERSION = "v1";
export const PARTNER_WELCOME_FREQUENCY_DEFAULT_HOURS = 24;

export type PartnerWelcomeFrequencyKeyInput = {
  campaignId: string;
  placementKey: string;
};

/** Clave canónica: versión + campaña + placement (no solo sponsor). */
export function buildPartnerWelcomeFrequencyStorageKey(
  input: PartnerWelcomeFrequencyKeyInput,
): string {
  const campaignId = input.campaignId.trim();
  const placementKey = input.placementKey.trim();
  return `dnx_partner_welcome_${PARTNER_WELCOME_FREQUENCY_STORAGE_VERSION}:${campaignId}:${placementKey}`;
}

/** Clave legacy InfoSpot (solo campaignId) — lectura para no resetear caps existentes. */
export function buildLegacyPartnerWelcomeFrequencyStorageKey(campaignId: string): string {
  return `dnx_partner_welcome_${campaignId.trim()}`;
}

export type PartnerWelcomeFrequencyStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

function defaultStore(): PartnerWelcomeFrequencyStore | null {
  if (typeof globalThis === "undefined") return null;
  try {
    const ls = (globalThis as { localStorage?: Storage }).localStorage;
    if (!ls) return null;
    return ls;
  } catch {
    return null;
  }
}

function parseTimestamp(raw: string | null): number | null {
  if (raw == null || raw === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

export type PartnerWelcomeFrequencyDecision = {
  /** true = puede mostrarse ahora */
  allowed: boolean;
  /** Timestamp registrado (si hay) */
  lastShownAt: number | null;
  /** Store disponible */
  storageAvailable: boolean;
};

/**
 * ¿Puede abrirse la activación según el cap local?
 * No escribe. No marca como vista.
 */
export function readPartnerWelcomeFrequency(input: {
  campaignId: string;
  placementKey: string;
  frequencyHours?: number;
  nowMs?: number;
  store?: PartnerWelcomeFrequencyStore | null;
  /** Tests: omitir cap. */
  disableFrequencyCap?: boolean;
}): PartnerWelcomeFrequencyDecision {
  if (input.disableFrequencyCap) {
    return { allowed: true, lastShownAt: null, storageAvailable: true };
  }

  const hours = input.frequencyHours ?? PARTNER_WELCOME_FREQUENCY_DEFAULT_HOURS;
  const now = input.nowMs ?? Date.now();
  const store = input.store === undefined ? defaultStore() : input.store;

  if (!store) {
    // Sin storage: permitir (session-only); la app no debe romper SSR/render.
    return { allowed: true, lastShownAt: null, storageAvailable: false };
  }

  const key = buildPartnerWelcomeFrequencyStorageKey(input);
  let lastShownAt: number | null = null;
  try {
    lastShownAt = parseTimestamp(store.getItem(key));
    if (lastShownAt == null) {
      // Compat InfoSpot: clave legacy solo por campaignId
      lastShownAt = parseTimestamp(
        store.getItem(buildLegacyPartnerWelcomeFrequencyStorageKey(input.campaignId)),
      );
    }
  } catch {
    return { allowed: true, lastShownAt: null, storageAvailable: false };
  }

  if (lastShownAt == null) {
    return { allowed: true, lastShownAt: null, storageAvailable: true };
  }

  const elapsedH = (now - lastShownAt) / (1000 * 60 * 60);
  if (elapsedH < hours) {
    return { allowed: false, lastShownAt, storageAvailable: true };
  }
  return { allowed: true, lastShownAt, storageAvailable: true };
}

/**
 * Registrar visualización efectiva (cuando la pieza realmente se abre).
 * Idempotente para la misma apertura; no almacena PII.
 */
export function markPartnerWelcomeShown(input: {
  campaignId: string;
  placementKey: string;
  nowMs?: number;
  store?: PartnerWelcomeFrequencyStore | null;
  disableFrequencyCap?: boolean;
}): void {
  if (input.disableFrequencyCap) return;
  const store = input.store === undefined ? defaultStore() : input.store;
  if (!store) return;
  const now = input.nowMs ?? Date.now();
  const key = buildPartnerWelcomeFrequencyStorageKey(input);
  try {
    store.setItem(key, String(now));
  } catch {
    // ignore quota / private mode
  }
}
