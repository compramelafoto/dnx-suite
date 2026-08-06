const FORBIDDEN_ALTS = new Set([
  "imagen",
  "image",
  "foto",
  "photo",
  "hero",
  "logo",
  "gallery",
  "galeria",
  "img",
  "picture",
]);

/** Alt usable: no vacío, no genérico, no nombre de archivo. */
export function isUsableContestAssetAlt(alt: string, fileName?: string | null): boolean {
  const t = alt.trim();
  if (t.length < 8) return false;
  if (FORBIDDEN_ALTS.has(t.toLowerCase())) return false;
  if (fileName) {
    const base = fileName.split("/").pop()?.toLowerCase() ?? "";
    if (base && t.toLowerCase() === base) return false;
    const stem = base.replace(/\.[^.]+$/, "");
    if (stem && t.toLowerCase() === stem) return false;
  }
  return true;
}
