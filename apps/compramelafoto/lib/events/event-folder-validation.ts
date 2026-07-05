const MAX_NAME_LEN = 200;
const MAX_SLUG_LEN = 80;
const MAX_DESC_LEN = 2000;

export function normalizeEventFolderName(raw: unknown): { ok: true; value: string } | { ok: false; error: string } {
  if (raw === undefined || raw === null) {
    return { ok: false, error: "El nombre es requerido." };
  }
  const s = String(raw).trim();
  if (!s) {
    return { ok: false, error: "El nombre es requerido." };
  }
  if (s.length > MAX_NAME_LEN) {
    return { ok: false, error: `El nombre no puede superar ${MAX_NAME_LEN} caracteres.` };
  }
  return { ok: true, value: s };
}

/** Slug estable para URLs internas/carpeta; vacío ⇒ null */
export function normalizeEventFolderSlug(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const s = String(raw).trim().toLowerCase();
  if (!s) {
    return { ok: true, value: null };
  }
  const slug = s
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LEN);
  if (!slug) {
    return { ok: false, error: "El slug sólo puede contener letras minúsculas, números y guiones." };
  }
  return { ok: true, value: slug };
}

export function normalizeOptionalDescription(raw: unknown): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const s = String(raw).trim();
  if (s.length > MAX_DESC_LEN) {
    return { ok: false, error: `La descripción no puede superar ${MAX_DESC_LEN} caracteres.` };
  }
  return { ok: true, value: s || null };
}

export function parseSortOrder(raw: unknown): number {
  const n = typeof raw === "number" ? raw : parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n)) return 0;
  return Math.min(2_147_483_647, Math.max(-2_147_483_648, Math.trunc(n)));
}
