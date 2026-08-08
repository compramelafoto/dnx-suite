/** Normaliza título para detección de duplicados. */
export function normalizeTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Alias / helper UI. */
export function normalizePromptTitle(title: string): string {
  return normalizeTitle(title);
}

export function slugifyLabel(value: string): string {
  const base = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "tema";
}

export function parseTagsInput(raw: string | string[] | null | undefined): string[] {
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((t) => t.trim()).filter(Boolean))];
  }
  if (!raw?.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[,;\n]/)
        .map((t) => t.trim())
        .filter(Boolean),
    ),
  ];
}
