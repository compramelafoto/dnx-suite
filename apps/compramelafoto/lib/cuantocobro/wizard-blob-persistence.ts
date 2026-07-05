import {
  ensureSchemaVersion,
  migrateStoredPayloadToCurrentVersion,
  stripSchemaVersionField,
} from "./schema-version";
import {
  getWizardStorageKey,
  resolveWizardBlobRaw,
  shouldMigrateWizardBlobToPrimary,
  type WizardBlobKind,
  type WizardBlobLoadSource,
  type WizardStorageAdapter,
} from "./wizard-storage-keys";

export function serializeWizardDomainBlob(payload: Record<string, unknown>): string {
  return JSON.stringify(ensureSchemaVersion(payload));
}

export function persistWizardDomainBlob(
  adapter: WizardStorageAdapter,
  userId: number | null,
  kind: WizardBlobKind,
  domainPayload: Record<string, unknown>,
): void {
  const key = getWizardStorageKey(kind, userId);
  try {
    adapter.setLocalItem(key, serializeWizardDomainBlob(domainPayload));
  } catch {
    /* ignore quota errors */
  }
}

export type WizardDomainBlobLoadResult<T> = {
  value: T;
  source: WizardBlobLoadSource;
  migrated: boolean;
};

export function loadWizardDomainBlob<T>(
  adapter: WizardStorageAdapter,
  userId: number | null,
  kind: WizardBlobKind,
  normalize: (raw: unknown) => T,
  initial: T,
): WizardDomainBlobLoadResult<T> {
  const resolved = resolveWizardBlobRaw(adapter, userId, kind);
  if (!resolved) {
    return { value: initial, source: "namespaced-local", migrated: false };
  }

  try {
    const parsed = JSON.parse(resolved.raw) as unknown;
    const migratedPayload = migrateStoredPayloadToCurrentVersion(parsed);
    const stripped = stripSchemaVersionField(migratedPayload);
    const normalized = normalize(stripped);
    const shouldMigrate = shouldMigrateWizardBlobToPrimary(resolved.source);

    if (shouldMigrate) {
      persistWizardDomainBlob(adapter, userId, kind, stripped as Record<string, unknown>);
    }

    return {
      value: normalized,
      source: resolved.source,
      migrated: shouldMigrate,
    };
  } catch {
    return { value: initial, source: resolved.source, migrated: false };
  }
}
