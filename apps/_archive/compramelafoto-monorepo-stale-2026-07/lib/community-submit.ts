/**
 * Helpers para alta de perfiles de comunidad: normalización y slug.
 */

export function slugFromName(name: string): string {
  return (
    (name ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "sin-nombre"
  );
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const s = (email ?? "").trim().toLowerCase();
  return s || null;
}

export function normalizeWhatsapp(whatsapp: string | null | undefined): string | null {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  return digits || null;
}

/** Acepta @handle o URL instagram.com/... y devuelve el handle sin @ */
export function normalizeInstagram(val: string | null | undefined): string | null {
  const s = (val ?? "").trim();
  if (!s) return null;
  const urlMatch = s.match(/instagram\.com\/([^/?\s]+)/i);
  if (urlMatch) return urlMatch[1].replace(/^@/, "");
  if (s.startsWith("@")) return s.slice(1).trim();
  return s;
}
