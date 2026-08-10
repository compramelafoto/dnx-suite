/**
 * ETAPA 16B — Guardia anti-PII para metadataJson de FotorankFinalistSnapshot.
 * "Assert no PII in snapshot metadata." Defensa en profundidad: aunque los callers de
 * esta etapa nunca deberían escribir estos campos, se valida en runtime antes de persistir.
 */
import { JuryError } from "./errors";

const FORBIDDEN_METADATA_KEYS = [
  "name",
  "nombre",
  "apellido",
  "lastName",
  "firstName",
  "fullName",
  "email",
  "correo",
  "phone",
  "telefono",
  "instagram",
  "instagramHandle",
  "socialHandle",
  "author",
  "authorName",
  "authorUserId",
  "participantId",
  "participantName",
  "userId",
  "dni",
  "documento",
  "address",
  "direccion",
  "gps",
  "exif",
] as const;

function containsForbiddenKey(value: unknown, path: string[] = []): string | null {
  if (value == null || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = containsForbiddenKey(item, path);
      if (hit) return hit;
    }
    return null;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    const lowerKey = key.toLowerCase();
    if (FORBIDDEN_METADATA_KEYS.some((forbidden) => lowerKey === forbidden.toLowerCase())) {
      return [...path, key].join(".");
    }
    const nested = containsForbiddenKey(val, [...path, key]);
    if (nested) return nested;
  }
  return null;
}

/** Lanza JuryError("PII_DETECTED") si metadataJson contiene claves potencialmente identificatorias. */
export function assertNoPiiInFinalistMetadata(metadataJson: unknown): void {
  const hit = containsForbiddenKey(metadataJson);
  if (hit) {
    throw new JuryError(
      "PII_DETECTED",
      `metadataJson de finalista contiene un campo potencialmente identificatorio: "${hit}".`,
      409,
    );
  }
}
