/**
 * Reglas de campos del perfil del fotógrafo, movidas tal cual desde
 * `PATCH /api/fotografo/update`. La unicidad del handler la sigue chequeando el llamador.
 */

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

type Stringable = { toString(): string } | null | undefined;

/** `#RRGGBB` → se guarda; `""` → null; cualquier otra cosa (incluido null) se ignora. */
export function normalizeHexColor(v: unknown): { set: true; value: string | null } | { set: false } {
  const color = (v as Stringable)?.toString().trim();
  if (color && HEX_COLOR.test(color)) return { set: true, value: color };
  if (color === "") return { set: true, value: null };
  return { set: false };
}

export const MSG_PUBLIC_PAGE_HANDLER_FORMAT = "El handler solo puede contener letras, números y guiones";

/** Minúsculas y sin espacios en los bordes; vacío → null. */
export function normalizePublicPageHandler(
  v: unknown
): { ok: true; value: string | null } | { ok: false; error: string } {
  const handler = (v as Stringable)?.toString().trim().toLowerCase() || null;
  if (handler && !/^[a-z0-9-]+$/.test(handler)) {
    return { ok: false, error: MSG_PUBLIC_PAGE_HANDLER_FORMAT };
  }
  return { ok: true, value: handler };
}

/** Pesos enteros. Debajo del mínimo → error; vacío, 0, negativo o inválido → el mínimo. */
export function normalizeDefaultDigitalPrice(
  v: unknown,
  min: number
): { ok: true; value: number } | { ok: false; error: string } {
  const price = v ? Number(v) : null;
  if (price !== null && Number.isFinite(price) && price >= 0) {
    if (price < min) {
      return {
        ok: false,
        error: `El precio por foto digital no puede ser menor al mínimo del sistema (${min} pesos)`,
      };
    }
    return { ok: true, value: price };
  }
  // Que el valor no quede nulo: usar siempre el mínimo de la plataforma como valor por defecto
  return { ok: true, value: min };
}
