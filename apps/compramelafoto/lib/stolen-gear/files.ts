import { randomUUID } from "node:crypto";
import { uploadToR2 } from "@/lib/r2-client";

/** Vercel corta los cuerpos de más de 4,5 MB: dejamos margen. El navegador achica las fotos. */
export const MAX_STOLEN_GEAR_FILE_BYTES = 4 * 1024 * 1024;

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function isAllowedStolenGearMime(mime: string): boolean {
  return mime in EXT_BY_MIME;
}

/**
 * Sube factura o denuncia policial bajo `stolen-gear/` con un nombre aleatorio
 * (sin datos del fotógrafo). Sólo se muestra con URL firmada desde el panel admin.
 */
export async function uploadStolenGearFile(file: File): Promise<{ key: string; mime: string }> {
  const mime = file.type;
  const ext = EXT_BY_MIME[mime];
  if (!ext) throw new Error("Formato no permitido. Usá JPG, PNG, WEBP o PDF.");
  if (file.size > MAX_STOLEN_GEAR_FILE_BYTES) throw new Error("El archivo pesa más de 4 MB.");
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = `stolen-gear/${randomUUID()}.${ext}`;
  await uploadToR2(buffer, key, mime);
  return { key, mime };
}
