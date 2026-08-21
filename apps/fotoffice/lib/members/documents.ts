/**
 * Única fuente de verdad para normalizar y validar documentos de socios.
 *
 * Función PURA: no toca la base, no depende de Prisma. La usan el alta manual, la edición y
 * el importador CSV — no puede haber dos criterios distintos entre el formulario y el import,
 * que es exactamente lo que produce duplicados por diferencia de formato.
 *
 * Perfilado del padrón real (152 socios, agosto 2026) antes de escribir esto: 0 documentos con
 * puntos, guiones o espacios, 0 registros `OTR`, y solo dos tipos en uso (DNI y CUIT). Por eso
 * normalizar es idempotente sobre los datos existentes: no reescribe ni un registro. Las reglas
 * de formato existen para lo que se cargue de acá en adelante.
 */

export type DocumentValidationStatus =
  /** Sin documento. Válido: el padrón admite socios sin documento. */
  | "ABSENT"
  /** Cumple el formato de su tipo. */
  | "VALID"
  /** Tipo conocido pero formato incorrecto (ej. un DNI de 5 dígitos). */
  | "INVALID";

export type NormalizedDocument = {
  /** Tipo canónico: "DNI", "CUIT" o el tipo original en mayúsculas si es otro. */
  canonicalType: string | null;
  /** Número listo para guardar. Solo dígitos en DNI y CUIT/CUIL. */
  normalizedNumber: string | null;
  validationStatus: DocumentValidationStatus;
  /** Mensaje para el usuario cuando `validationStatus === "INVALID"`. */
  message: string | null;
};

const DNI_ALIASES = new Set(["DNI", "D.N.I.", "D.N.I", "DOCUMENTO"]);
const CUIT_ALIASES = new Set(["CUIT", "CUIL", "CUIT/CUIL", "CUIL/CUIT", "C.U.I.T.", "C.U.I.L."]);
/** Marcador histórico genérico. Un `OTR` con 10-11 dígitos es en realidad un CUIT/CUIL. */
const OTHER_ALIASES = new Set(["OTR", "OTRO", "OTROS", "OTRA"]);

const DNI_MIN_DIGITS = 7;
const DNI_MAX_DIGITS = 8;
const CUIT_MIN_DIGITS = 10;
const CUIT_MAX_DIGITS = 11;

/** Solo los dígitos: descarta puntos, guiones (incluidos los tipográficos) y espacios. */
export function documentDigits(raw: string | null | undefined): string {
  return String(raw ?? "").replace(/\D/g, "");
}

function normalizeTypeToken(raw: string | null | undefined): string {
  return String(raw ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Normaliza y valida un par tipo+número.
 *
 * - **DNI**: se queda solo con los dígitos. 7 u 8 → válido. `12.345.678`, `12345678` y
 *   `12 345 678` producen exactamente el mismo resultado.
 * - **CUIT/CUIL**: solo dígitos, 10 u 11. `20-12345678-3` y `20123456783` son equivalentes.
 * - **OTR con 10-11 dígitos**: se reconoce como CUIT/CUIL. Es el uso histórico real de ese
 *   marcador; dejarlo como "OTR" perpetuaría un duplicado invisible contra el mismo CUIT.
 * - **Otros tipos** (pasaporte, libreta, y `OTR` que no sea un CUIT): NO se les aplica ninguna
 *   regla numérica — un pasaporte alfanumérico es legítimo. Solo se recortan espacios y se
 *   unifican mayúsculas, para que `ab 123 456` y `AB123456` no convivan como dos documentos.
 * - **Sin número**: `ABSENT`, con ambos campos en `null`. Nunca una cadena vacía: si el vacío
 *   se guardara como `""`, todos los socios sin documento colisionarían entre sí.
 */
export function normalizeDocument(
  rawType: string | null | undefined,
  rawNumber: string | null | undefined,
): NormalizedDocument {
  const numberTrimmed = String(rawNumber ?? "").trim();
  const typeToken = normalizeTypeToken(rawType);

  // Sin número no hay documento, sin importar qué diga el tipo.
  if (!numberTrimmed) {
    return { canonicalType: null, normalizedNumber: null, validationStatus: "ABSENT", message: null };
  }

  const digits = documentDigits(numberTrimmed);

  if (DNI_ALIASES.has(typeToken)) {
    const ok = digits.length >= DNI_MIN_DIGITS && digits.length <= DNI_MAX_DIGITS;
    return {
      canonicalType: "DNI",
      normalizedNumber: digits || null,
      validationStatus: ok ? "VALID" : "INVALID",
      message: ok
        ? null
        : `El DNI debe tener ${DNI_MIN_DIGITS} u ${DNI_MAX_DIGITS} dígitos (este tiene ${digits.length}). Podés escribirlo con o sin puntos.`,
    };
  }

  const isCuitAlias = CUIT_ALIASES.has(typeToken);
  const isOtherActingAsCuit =
    OTHER_ALIASES.has(typeToken) && digits.length >= CUIT_MIN_DIGITS && digits.length <= CUIT_MAX_DIGITS;

  if (isCuitAlias || isOtherActingAsCuit) {
    const ok = digits.length >= CUIT_MIN_DIGITS && digits.length <= CUIT_MAX_DIGITS;
    return {
      canonicalType: "CUIT",
      normalizedNumber: digits || null,
      validationStatus: ok ? "VALID" : "INVALID",
      message: ok
        ? null
        : `El CUIT/CUIL debe tener ${CUIT_MIN_DIGITS} u ${CUIT_MAX_DIGITS} dígitos (este tiene ${digits.length}). Podés escribirlo con o sin guiones.`,
    };
  }

  // Tipo desconocido o alfanumérico: se conserva tal cual, sin reglas numéricas.
  return {
    canonicalType: typeToken || null,
    normalizedNumber: numberTrimmed.toUpperCase().replace(/\s+/g, ""),
    validationStatus: "VALID",
    message: null,
  };
}

/**
 * Clave de deduplicación. Dos documentos que normalizan igual comparten clave, aunque se hayan
 * escrito distinto. `null` cuando no hay documento: la ausencia NUNCA es un duplicado —
 * si devolviera una clave fija, todos los socios sin documento chocarían entre sí.
 */
export function documentDedupKey(
  rawType: string | null | undefined,
  rawNumber: string | null | undefined,
): string | null {
  const { canonicalType, normalizedNumber, validationStatus } = normalizeDocument(rawType, rawNumber);
  if (validationStatus === "ABSENT" || !normalizedNumber) return null;
  return `${canonicalType ?? ""}::${normalizedNumber}`;
}

/**
 * Formato legible para pantalla. Nunca es lo que se guarda: la base conserva solo dígitos,
 * esto es presentación (`12345678` → `12.345.678`, `20123456783` → `20-12345678-3`).
 */
export function formatDocumentForDisplay(
  rawType: string | null | undefined,
  rawNumber: string | null | undefined,
): string {
  const { canonicalType, normalizedNumber } = normalizeDocument(rawType, rawNumber);
  if (!normalizedNumber) return "—";

  if (canonicalType === "DNI" && /^\d{7,8}$/.test(normalizedNumber)) {
    return `DNI ${Number(normalizedNumber).toLocaleString("es-AR")}`;
  }
  if (canonicalType === "CUIT" && /^\d{11}$/.test(normalizedNumber)) {
    return `CUIT ${normalizedNumber.slice(0, 2)}-${normalizedNumber.slice(2, 10)}-${normalizedNumber.slice(10)}`;
  }
  return `${canonicalType ?? ""} ${normalizedNumber}`.trim();
}

/**
 * ¿Cambió el documento respecto del que ya estaba guardado?
 *
 * Es la pieza que hace que la validación NO sea retroactiva: si el documento no cambió, no se
 * revalida. Un socio cargado hace años con un formato que hoy no pasaría (el padrón real tiene
 * uno con 5 dígitos) se puede seguir editando en todos sus otros campos sin quedar bloqueado.
 */
export function documentChanged(
  storedType: string | null | undefined,
  storedNumber: string | null | undefined,
  incomingType: string | null | undefined,
  incomingNumber: string | null | undefined,
): boolean {
  return documentDedupKey(storedType, storedNumber) !== documentDedupKey(incomingType, incomingNumber);
}
