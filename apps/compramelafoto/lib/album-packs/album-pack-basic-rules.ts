/**
 * Reglas básicas de un pack de álbum (nombre, precio y cantidad de fotos).
 * Movidas tal cual desde las rutas POST/PATCH de `/api/dashboard/albums/[id]/packs`:
 * mismos textos de error y mismo orden. El precio es en pesos enteros.
 */

export type PackRuleResult<T> = { ok: true; value: T } | { ok: false; error: string };

/** `create` (POST) y `update` (PATCH) usan textos distintos cuando el nombre queda vacío. */
export function parsePackName(raw: unknown, mode: "create" | "update"): PackRuleResult<string> {
  const name = String(raw ?? "").trim();
  if (!name) {
    return { ok: false, error: mode === "create" ? "name es requerido" : "name no puede estar vacío" };
  }
  return { ok: true, value: name };
}

export function parsePackPrice(raw: unknown): PackRuleResult<number> {
  const price = Number(raw);
  if (!Number.isInteger(price) || price < 0) {
    return { ok: false, error: "price debe ser un entero >= 0" };
  }
  return { ok: true, value: price };
}

/** `undefined`/`null` → null; si no, entero ≥ 1. */
export function parseIncludedPhotoCount(raw: unknown): PackRuleResult<number | null> {
  const includedPhotoCount = raw === undefined || raw === null ? null : Number(raw);
  if (
    includedPhotoCount !== null &&
    (!Number.isInteger(includedPhotoCount) || includedPhotoCount < 1)
  ) {
    return { ok: false, error: "includedPhotoCount debe ser un entero >= 1 o null" };
  }
  return { ok: true, value: includedPhotoCount };
}

export const MSG_INCLUDED_PHOTO_COUNT_REQUIRED =
  "includedPhotoCount es obligatorio cuando requiresSelection = true";

export function checkSelectionNeedsPhotoCount(
  requiresSelection: boolean,
  includedPhotoCount: number | null | undefined
): { ok: true } | { ok: false; error: string } {
  if (requiresSelection && includedPhotoCount == null) {
    return { ok: false, error: MSG_INCLUDED_PHOTO_COUNT_REQUIRED };
  }
  return { ok: true };
}

/**
 * Valida sólo las claves presentes (semántica `"x" in body` del PATCH).
 * Con `requiresSelection: true`, la cantidad de fotos es obligatoria.
 */
export function validatePackBasics(i: {
  name?: unknown;
  price?: unknown;
  requiresSelection?: boolean;
  includedPhotoCount?: unknown;
}):
  | { ok: true; name?: string; price?: number; includedPhotoCount?: number | null }
  | { ok: false; error: string } {
  const out: { ok: true; name?: string; price?: number; includedPhotoCount?: number | null } = { ok: true };
  if ("name" in i) {
    const r = parsePackName(i.name, "create");
    if (!r.ok) return r;
    out.name = r.value;
  }
  if ("price" in i) {
    const r = parsePackPrice(i.price);
    if (!r.ok) return r;
    out.price = r.value;
  }
  if ("includedPhotoCount" in i || i.requiresSelection) {
    const r = parseIncludedPhotoCount(i.includedPhotoCount);
    if (!r.ok) return r;
    const sel = checkSelectionNeedsPhotoCount(Boolean(i.requiresSelection), r.value);
    if (!sel.ok) return sel;
    out.includedPhotoCount = r.value;
  }
  return out;
}
