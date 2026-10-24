/**
 * Reglas puras para el logo institucional de una escuela (sin R2 ni Prisma),
 * compartidas por la subida del fotógrafo y la del organizador.
 */

export const SCHOOL_LOGO_ALLOWED_TYPES: ReadonlySet<string> = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const SCHOOL_LOGO_MAX_BYTES = 5 * 1024 * 1024;

export function normalizeSchoolLogoContentType(rawType: string | null | undefined): string {
  return (rawType || "image/jpeg").toLowerCase().split(";")[0].trim();
}

export function getSchoolLogoExtension(contentType: string, filename: string | null | undefined): string {
  const ext = filename?.toLowerCase().match(/\.[a-z0-9]+$/)?.[0]?.slice(1);
  if (ext && ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)) return ext;
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  return "jpg";
}

export type SchoolLogoFileCheck =
  | { ok: true; contentType: string; extension: string }
  | { ok: false; error: string };

export function validateSchoolLogoFile(file: {
  type?: string | null;
  size: number;
  name?: string | null;
}): SchoolLogoFileCheck {
  const contentType = normalizeSchoolLogoContentType(file.type);
  if (!SCHOOL_LOGO_ALLOWED_TYPES.has(contentType)) {
    return { ok: false, error: "Formato no soportado. Usá JPG, PNG, WebP o GIF." };
  }
  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (file.size > SCHOOL_LOGO_MAX_BYTES) {
    return { ok: false, error: "La imagen no puede superar 5 MB." };
  }
  return { ok: true, contentType, extension: getSchoolLogoExtension(contentType, file.name) };
}
