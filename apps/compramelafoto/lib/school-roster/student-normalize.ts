/**
 * Normalización de nombre para display y deduplicación ligera en roster escolar.
 */

export function normalizeFullName(firstName: string, lastName: string): string {
  const f = firstName.trim().replace(/\s+/g, " ");
  const l = lastName.trim().replace(/\s+/g, " ");
  return `${f} ${l}`.trim();
}

/**
 * Clave estable por escuela + identificadores (no criptográfica; solo dedupe operativo).
 */
export function buildNormalizedKey(
  schoolId: number,
  firstName: string,
  lastName: string,
  externalStudentId: string | null | undefined
): string {
  const ext = (externalStudentId ?? "").trim().toLowerCase();
  const f = firstName.trim().toLowerCase();
  const l = lastName.trim().toLowerCase();
  return `${schoolId}|${ext}|${f}|${l}`;
}

/** Colapsa espacios internos para búsqueda consistente con datos cargados en DB. */
export function normalizePersonNamePart(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * Normalización para comparar DNIs (matrícula nacional / documento):
 * minúsculas, sin espacios, puntos ni guiones ni guiones bajos.
 */
export function normalizeDniForComparison(dni: string | null | undefined): string | null {
  if (dni == null) return null;
  const trimmed = String(dni).trim().toLowerCase();
  if (!trimmed) return null;
  const folded = trimmed.replace(/\s+/g, "").replace(/[.\-_]/g, "");
  return folded.length ? folded : null;
}
