/** Escape HTML de texto de usuario — nunca insertar HTML crudo. */
export function escapeHtml(value: unknown): string {
  const s = value == null ? "" : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeCssUrl(url: string): string {
  return url.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\)/g, "\\)");
}

/** Solo colores CSS seguros (hex / rgb / rgba / hsl / hsla / nombres cortos). */
export function sanitizeCssColor(value: unknown, fallback = "#111111"): string {
  if (typeof value !== "string") return fallback;
  const t = value.trim();
  if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(t)) return t;
  if (/^rgba?\(\s*[\d.%\s,]+\s*\)$/i.test(t)) return t;
  if (/^hsla?\(\s*[\d.%\s,/deg]+\s*\)$/i.test(t)) return t;
  if (/^[a-z]{1,32}$/i.test(t)) return t.toLowerCase();
  return fallback;
}
