import type { ImagePreset } from "./presets";

/**
 * "MIME real": nunca confiar en `file.type` (lo pone el browser, se puede
 * falsear) ni en la extensión del nombre. Se leen los primeros bytes del
 * archivo y se comparan contra la firma binaria real del formato.
 * Sin dependencias nuevas — PNG/JPEG/WebP tienen firmas simples y estables.
 */
export type SniffedImageFormat = "image/png" | "image/jpeg" | "image/webp" | null;

export function sniffImageFormat(bytes: Uint8Array): SniffedImageFormat {
  if (bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 && // "RIFF"
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50 // "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export type ImageFileValidationError =
  | "FORMAT_NOT_ALLOWED"
  | "FORMAT_MISMATCH"
  | "TOO_LARGE"
  | "EMPTY_FILE";

export type ImageFileValidationResult =
  | { ok: true; format: NonNullable<SniffedImageFormat> }
  | { ok: false; error: ImageFileValidationError; message: string };

/**
 * Valida tamaño y formato real (por contenido, no por extensión/MIME declarado).
 * No valida dimensiones acá — eso se hace en el cliente (donde además se
 * puede avisar sin bloquear) para no depender de una librería de imágenes
 * en el server en esta primera etapa.
 */
export function validateImageFileBytes(
  bytes: Uint8Array,
  preset: Pick<ImagePreset, "acceptedFormats" | "maxFileSizeBytes">,
): ImageFileValidationResult {
  if (bytes.length === 0) {
    return { ok: false, error: "EMPTY_FILE", message: "El archivo está vacío." };
  }
  if (bytes.length > preset.maxFileSizeBytes) {
    const maxMb = (preset.maxFileSizeBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: "TOO_LARGE", message: `El archivo supera el máximo de ${maxMb} MB.` };
  }
  const sniffed = sniffImageFormat(bytes);
  if (!sniffed) {
    return {
      ok: false,
      error: "FORMAT_MISMATCH",
      message: "El archivo no es una imagen PNG, JPG o WebP válida (o está corrupto).",
    };
  }
  if (!preset.acceptedFormats.includes(sniffed)) {
    return {
      ok: false,
      error: "FORMAT_NOT_ALLOWED",
      message: `Formato no admitido para este campo (detectado: ${sniffed}).`,
    };
  }
  return { ok: true, format: sniffed };
}
