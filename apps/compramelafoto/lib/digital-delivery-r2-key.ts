/**
 * Resolución de archivos R2 para entrega digital (ZIP y descarga individual).
 * Solo originales en alta resolución — nunca previews con marca de agua.
 */

import { fileExistsInR2, readFromR2, urlToR2Key } from "@/lib/r2-client";
import {
  resolveOriginalR2KeyFromStored,
  resolvePreviewR2KeyFromPreviewUrl,
} from "@/lib/images/photo-variant-source";

export type DigitalDeliveryPhotoSource = {
  id?: number;
  originalKey: string | null;
  previewUrl?: string | null;
};

export type DigitalDeliveryReadResult = {
  buffer: Buffer;
  r2Key: string;
};

/** Candidatos de original en orden de preferencia (sin verificar existencia). */
export function digitalDeliveryOriginalR2KeyCandidates(
  photo: DigitalDeliveryPhotoSource
): string[] {
  const keys: string[] = [];

  const fromOriginal = photo.originalKey
    ? resolveOriginalR2KeyFromStored(photo.originalKey)
    : null;
  if (fromOriginal) keys.push(fromOriginal);

  const previewKey = resolvePreviewR2KeyFromPreviewUrl(photo.previewUrl);
  if (previewKey?.includes("preview_")) {
    const altOriginal = previewKey.replace("preview_", "original_");
    if (!keys.includes(altOriginal)) keys.push(altOriginal);
  }

  return keys;
}

export async function readDigitalDeliveryBuffer(
  photo: DigitalDeliveryPhotoSource
): Promise<DigitalDeliveryReadResult> {
  const candidates = digitalDeliveryOriginalR2KeyCandidates(photo);
  const errors: string[] = [];

  for (const key of candidates) {
    try {
      if (!(await fileExistsInR2(key))) {
        errors.push(`${key}: not found`);
        continue;
      }
      const buffer = await readFromR2(key);
      if (!buffer.length) {
        errors.push(`${key}: empty`);
        continue;
      }
      return { buffer, r2Key: key };
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const label = photo.id != null ? `photo ${photo.id}` : "photo";
  throw new Error(
    `No se encontró el original en alta resolución para ${label} (${errors.join("; ") || "sin candidatos"})`
  );
}

/** @deprecated Usar resolveOriginalR2KeyFromStored / readDigitalDeliveryBuffer */
export function getR2KeyFromPhotoKey(originalKey: string): string {
  if (!originalKey?.trim()) return originalKey;
  if (originalKey.startsWith("http://") || originalKey.startsWith("https://")) {
    return urlToR2Key(originalKey);
  }
  if (originalKey.startsWith("uploads/") || originalKey.startsWith("albums/")) {
    return originalKey;
  }
  if (originalKey.startsWith("/")) {
    return originalKey.replace(/^\//, "");
  }
  return `uploads/${originalKey}`;
}
