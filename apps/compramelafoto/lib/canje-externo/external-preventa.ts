/**
 * Pack de preventa cobrado por fuera de la plataforma (p. ej. un colegio que la fotógrafa
 * vendió por transferencia antes de usar CLF).
 *
 * A diferencia del combo externo (`external-voucher`, "N impresas de un tamaño"), acá cada
 * familia tiene un pack con varios productos — librito, copias sueltas, digitales — así que
 * se usa el canje de preventa de siempre: un `Order` PREVENTA_PACK pagado en $0, con su
 * `preventaPackSnapshotJson` armado a medida de lo que compró, y el link
 * `/canje/preventa/<token>`.
 *
 * Como no hubo compra en la plataforma, no hay `PreCompraOrder` con el nombre del alumno
 * ni email: el alumno, el curso y el adulto viajan en `redemptionPaymentRefsJson`, y el
 * email lo carga la familia al canjear.
 */

export const EXTERNAL_PREVENTA_KIND = "EXTERNAL_PREVENTA_PACK";

/** Obligatorio en el esquema; se reemplaza por el real cuando la familia canjea. */
export const EXTERNAL_SIN_EMAIL = "sin-email@canje-externo.invalid";

export function isPlaceholderEmail(email: string | null | undefined): boolean {
  return !email || email.trim().toLowerCase().endsWith(".invalid");
}

export type ExternalPreventaRefs = {
  kind: typeof EXTERNAL_PREVENTA_KIND;
  studentName: string | null;
  parentName: string | null;
  courseName: string | null;
  /**
   * El colegio, para el librito. Va con el pack porque estos álbumes pueden no estar vinculados
   * a un colegio: vincularlo pasa la galería a modo escolar (lista de alumnos, otras reglas de
   * preventa) y no se hace con familias por canjear.
   */
  schoolName: string | null;
  /** Lo que compró, en una línea: "1 librito formal + 1 copia grupal informal". */
  label: string | null;
};

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export function parseExternalPreventaRefs(raw: unknown): ExternalPreventaRefs | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (r.kind !== EXTERNAL_PREVENTA_KIND) return null;
  return {
    kind: EXTERNAL_PREVENTA_KIND,
    studentName: texto(r.studentName),
    parentName: texto(r.parentName),
    courseName: texto(r.courseName),
    schoolName: texto(r.schoolName),
    label: texto(r.label),
  };
}


/**
 * Parte el nombre de un alumno tal como vino en el Excel de una preventa cobrada por fuera.
 *
 * Esos listados traen el apellido primero («Araujo Ines»): se toma la primera palabra como
 * apellido y el resto como nombre. Un apellido compuesto («De La Fuente Juan») queda mal
 * partido; para el listado del curso y los formatos del nombre es un mal menor frente a no
 * tenerlos, y el nombre completo se sigue imprimiendo tal como vino.
 */
/**
 * "Valenza Sabrina" (como viene en el Excel: apellido primero) → "Sabrina Valenza", para saludar y
 * mostrar a la familia. Saludar con la primera palabra daba "Hola, Valenza".
 */
export function nombreNaturalDesdeExcel(raw: string | null | undefined): string | null {
  const partes = splitExcelStudentName(raw);
  if (!partes) return null;
  return [partes.firstName, partes.lastName].filter(Boolean).join(" ");
}

export function splitExcelStudentName(raw: string | null | undefined): { firstName: string; lastName: string } | null {
  const partes = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return { firstName: "", lastName: partes[0]! };
  return { lastName: partes[0]!, firstName: partes.slice(1).join(" ") };
}
