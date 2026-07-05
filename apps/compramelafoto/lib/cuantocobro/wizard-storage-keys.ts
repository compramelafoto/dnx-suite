export const WIZARD_LEGACY_PROFILE_KEY = "cuantocobro:profile";
export const WIZARD_LEGACY_QUOTE_KEY = "cuantocobro:quote";

export type WizardBlobKind = "profile" | "quote";

export type WizardBlobLoadSource = "namespaced-local" | "legacy-local" | "session";

export type WizardBlobLoadResult = {
  raw: string;
  source: WizardBlobLoadSource;
};

export type WizardStorageAdapter = {
  getLocalItem: (key: string) => string | null;
  setLocalItem: (key: string, value: string) => void;
  getSessionItem: (key: string) => string | null;
};

export function getWizardProfileStorageKey(userId: number | null | undefined): string {
  if (userId != null && Number.isFinite(userId) && userId > 0) {
    return `cuantocobro:${userId}:profile`;
  }
  return WIZARD_LEGACY_PROFILE_KEY;
}

export function getWizardQuoteStorageKey(userId: number | null | undefined): string {
  if (userId != null && Number.isFinite(userId) && userId > 0) {
    return `cuantocobro:${userId}:quote`;
  }
  return WIZARD_LEGACY_QUOTE_KEY;
}

export function getWizardStorageKey(
  kind: WizardBlobKind,
  userId: number | null | undefined,
): string {
  return kind === "profile"
    ? getWizardProfileStorageKey(userId)
    : getWizardQuoteStorageKey(userId);
}

function getLegacyKey(kind: WizardBlobKind): string {
  return kind === "profile" ? WIZARD_LEGACY_PROFILE_KEY : WIZARD_LEGACY_QUOTE_KEY;
}

/**
 * Orden de lectura:
 * 1. localStorage namespaced (o fallback sin userId)
 * 2. localStorage legacy sin namespace
 * 3. sessionStorage legacy
 */
export function resolveWizardBlobRaw(
  adapter: WizardStorageAdapter,
  userId: number | null | undefined,
  kind: WizardBlobKind,
): WizardBlobLoadResult | null {
  const primaryKey = getWizardStorageKey(kind, userId);
  const legacyKey = getLegacyKey(kind);

  const namespacedLocal = adapter.getLocalItem(primaryKey);
  if (namespacedLocal != null) {
    return { raw: namespacedLocal, source: "namespaced-local" };
  }

  if (legacyKey !== primaryKey) {
    const legacyLocal = adapter.getLocalItem(legacyKey);
    if (legacyLocal != null) {
      return { raw: legacyLocal, source: "legacy-local" };
    }
  }

  const sessionLegacy = adapter.getSessionItem(legacyKey);
  if (sessionLegacy != null) {
    return { raw: sessionLegacy, source: "session" };
  }

  return null;
}

export function shouldMigrateWizardBlobToPrimary(source: WizardBlobLoadSource): boolean {
  return source === "legacy-local" || source === "session";
}
