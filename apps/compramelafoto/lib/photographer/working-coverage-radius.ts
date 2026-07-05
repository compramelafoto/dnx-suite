/**
 * Radio de cobertura laboral del fotógrafo (km desde ubicación principal).
 * Persistido en `User.workingCoverageRadiusKm`.
 *
 * - `null` en BD = sin límite (sin filtro por distancia en eventos cercanos).
 * - Número permitido = radio en km.
 * - `undefined` (campo ausente en respuesta antigua) = 50 km por compatibilidad.
 *
 * Nota: `Lab.radiusKm` es exclusivo de laboratorios.
 */

export const WORKING_COVERAGE_RADIUS_OPTIONS = [
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
  { value: 50, label: "50 km" },
  { value: 100, label: "100 km" },
  { value: 250, label: "250 km" },
] as const;

export const WORKING_COVERAGE_ALLOWED_KM = WORKING_COVERAGE_RADIUS_OPTIONS.map((o) => o.value);

/** Valor por defecto (usuarios sin configuración explícita o legacy). */
export const WORKING_COVERAGE_DEFAULT_KM = 50;

const LEGACY_STORAGE_PREFIX = "clf:photographer:";

function legacyStorageKey(userId: number): string {
  return `${LEGACY_STORAGE_PREFIX}${userId}:workingCoverageRadiusKm`;
}

/** Normaliza un entero guardado a una opción permitida o null (sin límite). */
export function normalizeWorkingCoverageRadiusKm(
  value: number | null | undefined
): number | null {
  if (value === null) return null;
  if (value === undefined) return WORKING_COVERAGE_DEFAULT_KM;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return WORKING_COVERAGE_DEFAULT_KM;
  if ((WORKING_COVERAGE_ALLOWED_KM as readonly number[]).includes(n)) return n;
  return WORKING_COVERAGE_DEFAULT_KM;
}

/**
 * Valor para filtrar eventos cercanos.
 * @returns km máximo, o `null` si no hay tope (sin límite).
 */
export function resolveWorkingCoverageRadiusForEvents(
  stored: number | null | undefined
): number | null {
  if (stored === undefined) return WORKING_COVERAGE_DEFAULT_KM;
  if (stored === null) return null;
  return normalizeWorkingCoverageRadiusKm(stored);
}

/**
 * Valor para mostrar en el select del perfil.
 * `null` = opción «Sin límite»; número = km; undefined → 50 km visual.
 */
export function parseWorkingCoverageRadiusFromDb(
  stored: number | null | undefined
): number | null {
  if (stored === undefined) return WORKING_COVERAGE_DEFAULT_KM;
  if (stored === null) return null;
  return normalizeWorkingCoverageRadiusKm(stored);
}

export function formatCoverageRadiusLabel(km: number | null): string {
  if (km == null) return "Sin límite";
  const opt = WORKING_COVERAGE_RADIUS_OPTIONS.find((o) => o.value === km);
  return opt?.label ?? `${km} km`;
}

/** Valor para `<select>`: número en string o `unlimited`. */
export function coverageRadiusToSelectValue(km: number | null): string {
  if (km == null) return "unlimited";
  return String(km);
}

export function selectValueToCoverageRadius(value: string): number | null {
  if (value === "unlimited" || value === "") return null;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n <= 0) return WORKING_COVERAGE_DEFAULT_KM;
  if ((WORKING_COVERAGE_ALLOWED_KM as readonly number[]).includes(n)) return n;
  return WORKING_COVERAGE_DEFAULT_KM;
}

/** Payload para PATCH: null = sin límite; número = km permitido. */
export function serializeWorkingCoverageRadiusForApi(km: number | null): number | null {
  if (km === null) return null;
  return normalizeWorkingCoverageRadiusKm(km);
}

/**
 * Migra dato legacy de sessionStorage (una sola lectura) y lo borra.
 * Usar solo si la API aún no devolvió el campo.
 */
export function consumeLegacyWorkingCoverageRadiusKm(userId: number): number | null | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = sessionStorage.getItem(legacyStorageKey(userId));
    if (raw == null || raw === "") return undefined;
    sessionStorage.removeItem(legacyStorageKey(userId));
    if (raw === "unlimited" || raw === "null") return null;
    const n = parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
    return undefined;
  } catch {
    return undefined;
  }
}
