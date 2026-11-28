/**
 * Normalización de números de serie de equipos fotográficos.
 *
 * Debe coincidir EXACTO con la del SQL de la migración
 * `20270301090000_clf_equipos_robados`:
 *   ltrim(regexp_replace(upper(x), '[^A-Z0-9]', '', 'g'), '0')
 * Así "0123-456", "123 456" y "123456" son la misma serie.
 */
export const MIN_SERIAL_LENGTH = 4;

export function normalizeGearSerial(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const cleaned = String(raw)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .replace(/^0+/, "");
  // Series de ceros o demasiado cortas: las cámaras las graban "de relleno".
  if (cleaned.length < MIN_SERIAL_LENGTH) return null;
  return cleaned;
}

/** Dos marcas escritas distinto ("Canon" vs "CANON INC.") se consideran la misma. */
export function makesLookCompatible(a: string, b: string): boolean {
  const x = a.trim().toLowerCase();
  const y = b.trim().toLowerCase();
  if (!x || !y || x === "desconocido" || y === "desconocido") return true;
  return x.includes(y) || y.includes(x);
}
