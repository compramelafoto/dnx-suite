export function parseFaqFromLandingBlocks(json: unknown): { q: string; a: string }[] {
  if (!json || typeof json !== "object" || json === null) return [];
  const raw = (json as { faq?: unknown }).faq;
  if (!Array.isArray(raw)) return [];
  const out: { q: string; a: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as { q?: unknown; a?: unknown };
    const q = o.q != null ? String(o.q).trim() : "";
    const a = o.a != null ? String(o.a).trim() : "";
    if (q && a) out.push({ q, a });
  }
  return out;
}
