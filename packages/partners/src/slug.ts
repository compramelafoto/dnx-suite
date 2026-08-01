/** Normaliza un slug de partner: lowercase, guiones, sin espacios. */
export function normalizePartnerSlug(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function slugFromPartnerName(name: string): string {
  const slug = normalizePartnerSlug(name);
  return slug || "partner";
}

export function isValidPartnerSlug(slug: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length >= 2 && slug.length <= 80;
}
