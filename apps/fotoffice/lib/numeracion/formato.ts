export type FormatoNumero = { prefix: string; withYear: boolean; digits: number };
export type ConfigSecuencia = FormatoNumero & { nextValue: number };

export const MAX_PREFIJO = 8;
export const MAX_NEXT_VALUE = 1_999_999_999;

/** Con año: `{prefijo}{AAAA}-{N con ceros}`; sin año: `{prefijo}{N con ceros}`. */
export function formatearNumero(f: FormatoNumero, year: number | null, value: number): string {
  const n = String(value).padStart(f.digits, "0");
  return f.withYear && year !== null ? `${f.prefix}${year}-${n}` : `${f.prefix}${n}`;
}

function entero(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isInteger(raw) ? raw : null;
  if (typeof raw === "string" && /^\d+$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

/** `minimoProximo` = último número usado + 1 (1 si no se usó ninguno). */
export function validarConfigSecuencia(
  raw: { prefix: unknown; withYear: unknown; digits: unknown; nextValue: unknown },
  minimoProximo: number,
): { ok: true; config: ConfigSecuencia } | { ok: false; error: string } {
  if (raw.prefix !== undefined && raw.prefix !== null && typeof raw.prefix !== "string") return { ok: false, error: "El prefijo tiene que ser texto." };
  const prefix = ((raw.prefix as string | null | undefined) ?? "").trim();
  if (prefix.length > MAX_PREFIJO || !/^[A-Za-z0-9-]*$/.test(prefix)) {
    return { ok: false, error: `El prefijo puede tener hasta ${MAX_PREFIJO} caracteres: letras, números o guion.` };
  }
  if (typeof raw.withYear !== "boolean") return { ok: false, error: "Indicá si el número lleva año." };
  const digits = entero(raw.digits);
  if (digits === null || digits < 1 || digits > 8) return { ok: false, error: "Los dígitos tienen que estar entre 1 y 8." };
  const nextValue = entero(raw.nextValue);
  if (nextValue === null || nextValue < 1 || nextValue > MAX_NEXT_VALUE) return { ok: false, error: "El próximo número tiene que ser un entero desde 1." };
  if (nextValue < minimoProximo) return { ok: false, error: "No se puede volver a un número ya usado." };
  return { ok: true, config: { prefix, withYear: raw.withYear, digits, nextValue } };
}
