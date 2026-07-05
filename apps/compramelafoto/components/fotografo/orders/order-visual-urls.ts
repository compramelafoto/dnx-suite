/**
 * Construye URL pública R2 en cliente (solo NEXT_PUBLIC_*).
 * Usado para previews de ítems de impresión con fileKey directo.
 */
export function buildClientR2PublicUrl(keyOrUrl: string | null | undefined): string | null {
  if (!keyOrUrl || typeof keyOrUrl !== "string") return null;
  const raw = keyOrUrl.trim();
  if (!raw || raw === "[Protegido]") return null;

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return raw;
  }

  const base =
    process.env.NEXT_PUBLIC_R2_PUBLIC_URL ||
    process.env.NEXT_PUBLIC_R2_PUBLIC_BASE_URL ||
    null;

  if (!base) return null;

  const normalizedBase = base.replace(/\/$/, "");
  const key = raw.replace(/^\//, "");
  return `${normalizedBase}/${key}`;
}

export function buildPhotoThumbViewUrl(photoId: number, albumId?: number | null): string {
  const params = new URLSearchParams({ mode: "thumb" });
  if (albumId && Number.isFinite(albumId)) {
    params.set("albumId", String(albumId));
  }
  return `/api/photos/${photoId}/view?${params.toString()}`;
}

const PHOTO_REF = /^photo:(\d+)$/i;

export function parsePrintOrderFileKey(fileKey: string): { kind: "photo"; photoId: number } | { kind: "r2"; url: string } | null {
  const match = fileKey.match(PHOTO_REF);
  if (match) {
    const photoId = Number(match[1]);
    if (Number.isFinite(photoId)) return { kind: "photo", photoId };
  }
  const r2 = buildClientR2PublicUrl(fileKey);
  if (r2) return { kind: "r2", url: r2 };
  return null;
}
