import type { CategoryOption } from "./schemas";

const AR_PROVINCES: Record<string, string> = {
  caba: "CABA",
  "ciudad autonoma de buenos aires": "CABA",
  "buenos aires": "Buenos Aires",
  cordoba: "Córdoba",
  córdoba: "Córdoba",
  santafe: "Santa Fe",
  "santa fe": "Santa Fe",
  mendoza: "Mendoza",
  tucuman: "Tucumán",
  tucumán: "Tucumán",
  salta: "Salta",
  entrerios: "Entre Ríos",
  "entre rios": "Entre Ríos",
  "entre ríos": "Entre Ríos",
};

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeBool(raw: string): boolean | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (["true", "1", "si", "sí", "yes"].includes(v)) return true;
  if (["false", "0", "no"].includes(v)) return false;
  return null;
}

export function normalizeDate(raw: string): { value: string | null; review?: string } {
  const v = raw.trim();
  if (!v) return { value: null };
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const d = new Date(`${v}T12:00:00`);
    if (Number.isNaN(d.getTime())) return { value: null, review: "Fecha inválida" };
    return { value: v };
  }
  return { value: null, review: `Fecha no reconocida («${v}»). Usá YYYY-MM-DD.` };
}

export function normalizeTime(raw: string): { value: string | null; review?: string } {
  const v = raw.trim();
  if (!v) return { value: null };
  const m = v.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return { value: null, review: `Hora no reconocida («${v}»). Usá HH:mm.` };
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return { value: null, review: "Hora fuera de rango" };
  return { value: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}` };
}

export function toDatetimeLocal(date: string | null, time: string | null): string | null {
  if (!date) return null;
  const t = time || "00:00";
  return `${date}T${t}`;
}

export function normalizeUrl(raw: string): { value: string | null; review?: string } {
  const v = raw.trim();
  if (!v) return { value: null };
  let url = v;
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    if (!["http:", "https:"].includes(u.protocol)) {
      return { value: null, review: "URL con protocolo no permitido" };
    }
    return { value: u.toString() };
  } catch {
    return { value: null, review: `URL inválida («${v}»)` };
  }
}

export function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+\s()-]/g, "").replace(/\s+/g, " ").trim();
}

export function normalizeProvince(raw: string): string {
  const key = normalizeWhitespace(raw).toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const compact = key.replace(/\s+/g, "");
  return AR_PROVINCES[key] || AR_PROVINCES[compact] || normalizeWhitespace(raw);
}

export function normalizeCountry(raw: string): string {
  const v = normalizeWhitespace(raw);
  if (!v) return "";
  if (/^(ar|argentina)$/i.test(v)) return "Argentina";
  return v;
}

export function matchCategory(
  label: string,
  categories: CategoryOption[],
): { id: string | null; unknown: boolean; suggestion?: string } {
  const q = normalizeWhitespace(label);
  if (!q) return { id: null, unknown: false };
  const lower = q.toLowerCase();
  const exact = categories.find(
    (c) => c.name.toLowerCase() === lower || c.slug.toLowerCase() === lower,
  );
  if (exact) return { id: exact.id, unknown: false };

  const partial = categories.find(
    (c) =>
      c.name.toLowerCase().includes(lower) ||
      lower.includes(c.name.toLowerCase()) ||
      c.slug.toLowerCase().includes(lower),
  );
  if (partial) {
    return {
      id: null,
      unknown: true,
      suggestion: `¿Quisiste decir «${partial.name}»? Seleccionala en el formulario.`,
    };
  }
  return {
    id: null,
    unknown: true,
    suggestion: `Categoría «${q}» no existe en Info Spot. Elegí una del listado.`,
  };
}

export function unescapeMarkdownBody(raw: string): string {
  return raw
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"');
}

export function parseTags(raw: string): string[] {
  if (!raw.trim()) return [];
  return raw
    .split("|")
    .map((t) => normalizeWhitespace(t))
    .filter(Boolean)
    .slice(0, 20);
}
