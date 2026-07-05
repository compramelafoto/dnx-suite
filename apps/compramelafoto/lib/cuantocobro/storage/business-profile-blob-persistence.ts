import {
  ensureSchemaVersion,
  migrateStoredPayloadToCurrentVersion,
  stripSchemaVersionField,
} from "../schema-version";
import type { WizardStorageAdapter } from "../wizard-storage-keys";

/** Debe coincidir con `CUANTO_COBRO_BUSINESS_PROFILE_KEY` en business-profile.ts */
export const CUANTO_COBRO_BUSINESS_PROFILE_STORAGE_KEY = "cuantocobro:business-profile";

/** Debe coincidir con `CC_BUSINESS_PROFILE_UPDATED_EVENT` en business-profile.ts */
export const CC_BUSINESS_PROFILE_UPDATED_EVENT_NAME = "cuantocobro:business-profile-updated";

export type BusinessProfileBlobNormalizers<TProfile extends Record<string, unknown>> = {
  normalize: (raw: Partial<TProfile> | null | undefined) => TProfile;
  hasContent: (profile: TProfile) => boolean;
};

export function loadBusinessProfileFromStorage<TProfile extends Record<string, unknown>>(
  lowLevel: WizardStorageAdapter,
  normalizers: BusinessProfileBlobNormalizers<TProfile>,
): TProfile | null {
  try {
    const raw = lowLevel.getLocalItem(CUANTO_COBRO_BUSINESS_PROFILE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<TProfile>;
    const migrated = migrateStoredPayloadToCurrentVersion(parsed);
    const normalized = normalizers.normalize(
      stripSchemaVersionField(migrated) as Partial<TProfile>,
    );
    return normalizers.hasContent(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function saveBusinessProfileToStorage<TProfile extends Record<string, unknown>>(
  lowLevel: WizardStorageAdapter,
  profile: TProfile,
  normalizers: BusinessProfileBlobNormalizers<TProfile>,
): void {
  const payload = normalizers.normalize({
    ...profile,
    updatedAt: new Date().toISOString(),
  } as Partial<TProfile>);

  try {
    lowLevel.setLocalItem(
      CUANTO_COBRO_BUSINESS_PROFILE_STORAGE_KEY,
      JSON.stringify(ensureSchemaVersion(payload)),
    );
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent(CC_BUSINESS_PROFILE_UPDATED_EVENT_NAME, { detail: payload }));
    }
  } catch {
    /* ignore quota errors */
  }
}
