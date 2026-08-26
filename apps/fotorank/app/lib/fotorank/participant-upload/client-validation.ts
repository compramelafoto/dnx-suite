import type { UploadPolicy } from "../entries/upload-policy";
import { clientValidationMessage } from "./error-messages";
import type { ClientFileValidationResult } from "./types";

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

function readImageSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("READ_FAILED"));
    };
    img.src = url;
  });
}

/**
 * Validación cliente para feedback inmediato.
 * Nunca reemplaza la validación servidor.
 */
export async function validateFileClient(
  file: File,
  policy: UploadPolicy,
): Promise<ClientFileValidationResult> {
  if (!file || file.size <= 0) {
    return { ok: false, code: "EMPTY", message: clientValidationMessage("EMPTY") };
  }

  const ext = extensionOf(file.name);
  if (!policy.allowedExtensions.includes(ext)) {
    return { ok: false, code: "EXTENSION", message: clientValidationMessage("EXTENSION") };
  }

  const mime = (file.type || "").toLowerCase();
  if (mime && !policy.allowedMimeTypes.includes(mime)) {
    return { ok: false, code: "MIME", message: clientValidationMessage("MIME") };
  }

  if (file.size > policy.maxFileSizeBytes) {
    return { ok: false, code: "TOO_LARGE", message: clientValidationMessage("TOO_LARGE") };
  }

  let width = 0;
  let height = 0;
  try {
    const dims = await readImageSize(file);
    width = dims.width;
    height = dims.height;
  } catch {
    return { ok: false, code: "READ_FAILED", message: clientValidationMessage("READ_FAILED") };
  }

  if (width < policy.minWidth || height < policy.minHeight) {
    return { ok: false, code: "TOO_SMALL_DIM", message: clientValidationMessage("TOO_SMALL_DIM") };
  }
  if (width > policy.maxWidth || height > policy.maxHeight) {
    return { ok: false, code: "TOO_LARGE_DIM", message: clientValidationMessage("TOO_LARGE_DIM") };
  }

  const mp = (width * height) / 1_000_000;
  if (mp < policy.minMegapixels) {
    return { ok: false, code: "TOO_FEW_MP", message: clientValidationMessage("TOO_FEW_MP") };
  }

  return {
    ok: true,
    width,
    height,
    sizeBytes: file.size,
    mimeType: mime || "image/jpeg",
    name: file.name,
  };
}

/** Versión síncrona para tests sin DOM Image (solo size/ext/mime). */
export function validateFileClientSyncBasics(
  file: { name: string; size: number; type: string },
  policy: UploadPolicy,
): { ok: boolean; code?: string; message?: string } {
  if (file.size <= 0) {
    return { ok: false, code: "EMPTY", message: clientValidationMessage("EMPTY") };
  }
  const ext = extensionOf(file.name);
  if (!policy.allowedExtensions.includes(ext)) {
    return { ok: false, code: "EXTENSION", message: clientValidationMessage("EXTENSION") };
  }
  const mime = (file.type || "").toLowerCase();
  if (mime && !policy.allowedMimeTypes.includes(mime)) {
    return { ok: false, code: "MIME", message: clientValidationMessage("MIME") };
  }
  if (file.size > policy.maxFileSizeBytes) {
    return { ok: false, code: "TOO_LARGE", message: clientValidationMessage("TOO_LARGE") };
  }
  return { ok: true };
}
