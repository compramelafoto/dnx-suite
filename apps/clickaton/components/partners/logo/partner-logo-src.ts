/**
 * URL de visualización para assets de marca.
 * Preferimos el proxy same-origin: R2_PUBLIC_URL a veces no sirve estas keys.
 */
export function resolvePartnerBrandAssetSrc(input: {
  fileUrl?: string | null;
  storageKey?: string | null;
}): string | null {
  const key = input.storageKey?.trim();
  if (key) {
    const cleaned = key.replace(/^\/+/, "");
    if (cleaned.startsWith("clickaton/partners/")) {
      return `/api/media/${cleaned}`;
    }
  }
  const url = input.fileUrl?.trim();
  if (!url) return null;
  if (url.startsWith("/api/media/") || url.startsWith("/uploads/")) return url;
  // URL absoluta R2: si tenemos storageKey ya salimos arriba; si no, devolver tal cual.
  return url;
}
