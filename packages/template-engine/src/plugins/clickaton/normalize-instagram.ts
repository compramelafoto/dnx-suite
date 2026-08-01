export type NormalizeInstagramResult =
  | { ok: true; handle: string; displayHandle: string }
  | { ok: false; error: string; code: "empty" | "invalid" };

const HANDLE_RE = /^[a-z0-9](?:[a-z0-9._]{0,28}[a-z0-9])?$/i;

/**
 * Normaliza handles / URLs de Instagram sin requests externos.
 * Interno: sin @. Display: con un solo @.
 */
export function normalizeInstagramHandle(raw: unknown): NormalizeInstagramResult {
  if (raw == null) {
    return { ok: false, error: "Instagram vacío", code: "empty" };
  }
  let s = String(raw).trim();
  if (!s) {
    return { ok: false, error: "Instagram vacío", code: "empty" };
  }

  s = s.replace(/\s+/g, "");

  // URLs
  s = s.replace(/^https?:\/\//i, "");
  s = s.replace(/^www\./i, "");
  if (/^instagram\.com\//i.test(s)) {
    s = s.replace(/^instagram\.com\//i, "");
  }
  // path noise
  s = s.split(/[?#]/)[0] ?? s;
  s = s.replace(/\/+$/g, "");
  if (s.includes("/")) {
    // take first segment only
    s = s.split("/")[0] ?? s;
  }

  s = s.replace(/^@+/, "");
  s = s.toLowerCase();

  if (!s) {
    return { ok: false, error: "Instagram vacío", code: "empty" };
  }
  if (s.length < 1 || s.length > 30) {
    return { ok: false, error: "Longitud de Instagram inválida", code: "invalid" };
  }
  if (!HANDLE_RE.test(s)) {
    return { ok: false, error: "Caracteres de Instagram inválidos", code: "invalid" };
  }

  return { ok: true, handle: s, displayHandle: `@${s}` };
}
