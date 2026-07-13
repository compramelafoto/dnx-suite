/**
 * Guardas de upload para impresión (/api/uploads y /api/print-orders/uploads).
 */

export const PRINT_UPLOAD_MAX_BYTES_DEFAULT = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "heic",
  "heif",
  "pdf",
]);

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
]);

const BLOCKED_EXT = new Set([
  "exe",
  "bat",
  "cmd",
  "sh",
  "js",
  "mjs",
  "cjs",
  "php",
  "html",
  "htm",
  "svg",
  "xml",
]);

export function getExtension(filename: string): string {
  const i = filename.lastIndexOf(".");
  if (i < 0 || i === filename.length - 1) return "";
  return filename.slice(i + 1).toLowerCase();
}

export function contentTypeFromFilename(filename: string): string {
  const ext = getExtension(filename);
  const map: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
    heic: "image/heic",
    heif: "image/heif",
    pdf: "application/pdf",
  };
  return map[ext] || "application/octet-stream";
}

export function isAllowedPrintUpload(filename: string, declaredMime?: string | null): {
  ok: boolean;
  contentType: string;
  reason?: string;
} {
  const ext = getExtension(filename);
  if (!ext) {
    return { ok: false, contentType: "application/octet-stream", reason: "Archivo sin extensión" };
  }
  if (BLOCKED_EXT.has(ext)) {
    return { ok: false, contentType: "application/octet-stream", reason: "Tipo de archivo no permitido" };
  }
  if (!ALLOWED_EXT.has(ext)) {
    return { ok: false, contentType: "application/octet-stream", reason: "Extensión no permitida" };
  }
  const contentType = contentTypeFromFilename(filename);
  if (!ALLOWED_MIME.has(contentType)) {
    return { ok: false, contentType, reason: "MIME no permitido" };
  }
  if (declaredMime && declaredMime !== "application/octet-stream") {
    const normalized = declaredMime.split(";")[0].trim().toLowerCase();
    if (normalized && !ALLOWED_MIME.has(normalized) && normalized !== contentType) {
      // Permitir mismatch leve image/jpg vs image/jpeg solo si ambos son imagen permitida
      if (!(normalized.startsWith("image/") && contentType.startsWith("image/"))) {
        return { ok: false, contentType, reason: "MIME declarado no coincide con el tipo permitido" };
      }
    }
  }
  return { ok: true, contentType };
}

export function getMaxUploadBytes(): number {
  const raw = process.env.MAX_FILE_SIZE;
  if (!raw) return PRINT_UPLOAD_MAX_BYTES_DEFAULT;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : PRINT_UPLOAD_MAX_BYTES_DEFAULT;
}

export function sanitizeUploadBasename(name: string): string {
  const base = name.replace(/\\/g, "/").split("/").pop() || "archivo";
  return base.replace(/[^\w.\-()\sáéíóúÁÉÍÓÚñÑ]/g, "_").slice(0, 180);
}
