import { fail, ok, type Result } from "../result";
import { parseDesignDocument } from "./parse";
import { DESIGN_SCHEMA_VERSION, type DesignDocument } from "./schema";

/** Lleva un documento de la versión N a la N+1. */
export type DocumentMigration = (doc: Record<string, unknown>) => Record<string, unknown>;

/**
 * Registro de migraciones, indexado por la versión de origen.
 * Está vacío porque hoy la única versión es la 1. La maquinaria existe igual: escribirla
 * cuando ya haya plantillas guardadas es mucho más caro.
 */
export const DOCUMENT_MIGRATIONS: Record<number, DocumentMigration> = {};

function esObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Sube un documento hasta la versión actual del esquema aplicando migraciones sucesivas.
 * Nunca adivina: si falta una migración o el documento viene del futuro, falla con el motivo.
 */
export function migrateDesignDocument(
  raw: unknown,
  migrations: Record<number, DocumentMigration> = DOCUMENT_MIGRATIONS,
): Result<Record<string, unknown>> {
  if (!esObjeto(raw)) return fail("Esto no es un documento de diseño.");

  const declarada = raw.schemaVersion;
  if (typeof declarada !== "number" || !Number.isInteger(declarada)) {
    return fail("El documento no declara su versión de esquema.");
  }
  if (declarada > DESIGN_SCHEMA_VERSION) {
    return fail(
      `El documento fue creado con una versión más nueva del editor (esquema ${declarada}; este entiende hasta el ${DESIGN_SCHEMA_VERSION}). Actualizá la aplicación para abrirlo.`,
    );
  }

  let actual: Record<string, unknown> = raw;
  let version = declarada;
  /** Tope defensivo: una migración mal escrita no puede colgar el proceso. */
  let vueltas = 0;

  while (version < DESIGN_SCHEMA_VERSION) {
    if (vueltas++ > 100) {
      return fail("Las migraciones del documento no terminan. Es un error del propio módulo.");
    }
    const migracion = migrations[version];
    if (!migracion) {
      return fail(
        `No hay forma de actualizar un documento de esquema ${version} al ${DESIGN_SCHEMA_VERSION}. Falta escribir esa migración.`,
      );
    }
    const siguiente = migracion(actual);
    const nuevaVersion = siguiente.schemaVersion;
    if (typeof nuevaVersion !== "number" || nuevaVersion <= version) {
      return fail(
        `La migración de esquema ${version} no avanzó la versión del documento. Es un error del propio módulo.`,
      );
    }
    actual = siguiente;
    version = nuevaVersion;
  }

  return ok(actual);
}

/**
 * Puerta pública de lectura: migra y después valida. Todo el módulo entra por acá.
 */
export function readDesignDocument(
  raw: unknown,
  migrations: Record<number, DocumentMigration> = DOCUMENT_MIGRATIONS,
): Result<DesignDocument> {
  const migrado = migrateDesignDocument(raw, migrations);
  if (!migrado.ok) return migrado;
  return parseDesignDocument(migrado.value);
}
