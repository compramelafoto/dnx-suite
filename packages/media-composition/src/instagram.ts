/**
 * Normalización de handles Instagram (reutilizable DNX).
 * Guarda siempre el usuario limpio sin @.
 */

const HANDLE_RE = /^[a-z0-9._]{1,30}$/;

export type InstagramNormalized = {
  handle: string;
  normalized: string;
  url: string;
};

export function normalizeInstagramHandle(raw: string | null | undefined): InstagramNormalized | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "");
  s = s.split(/[/?#]/)[0] ?? s;
  s = s.replace(/^@+/, "");
  s = s.replace(/\s+/g, "");
  s = s.toLowerCase();
  // Rechazar si quedan caracteres inválidos (no silenciar "bad!!" → "bad").
  if (!/^[a-z0-9._]+$/.test(s)) return null;
  if (!HANDLE_RE.test(s)) return null;
  return {
    handle: s,
    normalized: s,
    url: `https://instagram.com/${s}`,
  };
}

export function assertInstagramHandle(raw: string): InstagramNormalized {
  const n = normalizeInstagramHandle(raw);
  if (!n) {
    throw new Error("INSTAGRAM_INVALID");
  }
  return n;
}
