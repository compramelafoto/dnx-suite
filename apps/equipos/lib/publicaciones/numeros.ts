/**
 * Pesos o dólares enteros desde un campo de formulario. Vacío → null. Sólo dígitos, o puntos
 * como separador de miles (`1.850.000`). Cualquier otra cosa (coma, decimales, letras) → NaN,
 * y el dominio la rechaza con su mensaje.
 */
export function parseEnteroPesos(raw: FormDataEntryValue | null): number | null {
  const v = typeof raw === "string" ? raw.trim() : "";
  if (!v) return null;
  if (/^\d+$/.test(v)) return Number(v);
  if (/^\d{1,3}(\.\d{3})+$/.test(v)) return Number(v.replace(/\./g, ""));
  return Number.NaN;
}
