/**
 * Versionado de esquema para blobs persistidos de ¿Cuánto Cobro? (local/session storage).
 * Sin `schemaVersion` en datos legacy → se asume versión 1.
 */

export const CUANTO_COBRO_CURRENT_SCHEMA_VERSION = 1;

export type SchemaVersionedPayload<T extends Record<string, unknown>> = T & {
  schemaVersion: number;
};

/** Envelope para bibliotecas almacenadas como array en v0 (legacy implícito v1). */
export type CuantoCobroTemplatesStorePayload = {
  schemaVersion: number;
  templates: unknown[];
};

export type SchemaMigrationFn = (payload: unknown) => unknown;

/**
 * Registro de migraciones incrementales (vN → vN+1).
 * Futuro: `1: migrateSchemaV1ToV2`, `2: migrateSchemaV2ToV3`, …
 */
const SCHEMA_MIGRATIONS: Partial<Record<number, SchemaMigrationFn>> = {
  // 1: migrateSchemaV1ToV2,
};

export function getCurrentSchemaVersion(): number {
  return CUANTO_COBRO_CURRENT_SCHEMA_VERSION;
}

/** Lee la versión persistida; datos sin campo → 1. */
export function resolveStoredSchemaVersion(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return 1;
  }

  const version = (raw as { schemaVersion?: unknown }).schemaVersion;
  if (typeof version !== "number" || !Number.isFinite(version) || version < 1) {
    return 1;
  }

  return Math.floor(version);
}

/** Añade o actualiza `schemaVersion` al valor actual antes de persistir. */
export function ensureSchemaVersion<T extends Record<string, unknown>>(
  payload: T,
): SchemaVersionedPayload<T> {
  return {
    ...payload,
    schemaVersion: getCurrentSchemaVersion(),
  };
}

/** Quita metadato de versión antes de normalizar dominio (profile, quote, business). */
export function stripSchemaVersionField<T>(payload: T): T {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }

  const { schemaVersion: _schemaVersion, ...rest } = payload as T & { schemaVersion?: unknown };
  return rest as T;
}

/**
 * Aplica la cadena de migraciones hasta la versión actual.
 * Hoy no hay saltos: legacy sin campo y v1 pasan sin transformar el dominio.
 */
export function migrateStoredPayloadToCurrentVersion(raw: unknown): unknown {
  let current = raw;
  let version = resolveStoredSchemaVersion(current);
  const target = getCurrentSchemaVersion();

  while (version < target) {
    const migrate = SCHEMA_MIGRATIONS[version];
    if (!migrate) {
      break;
    }
    current = migrate(current);
    version += 1;
  }

  return current;
}

/** Extrae ítems de plantillas desde array legacy o envelope versionado. */
export function parseVersionedTemplatesStore(raw: unknown): unknown[] {
  const migrated = migrateStoredPayloadToCurrentVersion(raw);

  if (Array.isArray(migrated)) {
    return migrated;
  }

  if (migrated && typeof migrated === "object") {
    const templates = (migrated as Partial<CuantoCobroTemplatesStorePayload>).templates;
    if (Array.isArray(templates)) {
      return templates;
    }
  }

  return [];
}

/** Serializa biblioteca de plantillas con envelope versionado. */
export function serializeVersionedTemplatesStore(templates: unknown[]): string {
  return JSON.stringify(ensureSchemaVersion({ templates }));
}

// --- Stubs para futuros sprints (no registrados aún en SCHEMA_MIGRATIONS) ---

/** @future Migración v1 → v2 */
export function migrateSchemaV1ToV2(payload: unknown): unknown {
  return payload;
}

/** @future Migración v2 → v3 */
export function migrateSchemaV2ToV3(payload: unknown): unknown {
  return payload;
}
