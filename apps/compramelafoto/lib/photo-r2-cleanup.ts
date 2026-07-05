/**
 * Borrado de objetos R2 asociados a una foto (preview, original, variantes).
 */

import { deleteFromR2, listObjectsByPrefix, urlToR2Key } from "@/lib/r2-client";
import {
  resolveOriginalR2KeyFromStored,
  resolvePreviewR2KeyFromPreviewUrl,
  derivePreviewR2KeyFromOriginalKey,
} from "@/lib/images/photo-variant-source";

export type PhotoR2CleanupSource = {
  id?: number;
  originalKey?: string | null;
  previewUrl?: string | null;
  thumbWatermarkedKey?: string | null;
  previewWatermarkedKey?: string | null;
};

function normalizeStoredKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return urlToR2Key(trimmed);
  }
  return trimmed.replace(/^\//, "");
}

/** Todas las keys R2 vinculadas a la foto (original, preview, variantes con marca). */
export function collectPhotoR2KeysForDeletion(photo: PhotoR2CleanupSource): string[] {
  const keys = new Set<string>();

  if (photo.originalKey?.trim()) {
    const original = resolveOriginalR2KeyFromStored(photo.originalKey);
    if (original) keys.add(original);
    const derivedPreview = derivePreviewR2KeyFromOriginalKey(photo.originalKey);
    if (derivedPreview) keys.add(derivedPreview);
  }

  const previewFromUrl = resolvePreviewR2KeyFromPreviewUrl(photo.previewUrl);
  if (previewFromUrl) {
    keys.add(previewFromUrl);
    if (previewFromUrl.includes("preview_")) {
      keys.add(previewFromUrl.replace("preview_", "original_"));
    }
  }

  for (const wm of [photo.thumbWatermarkedKey, photo.previewWatermarkedKey]) {
    const raw = wm?.trim();
    if (!raw) continue;
    try {
      keys.add(normalizeStoredKey(raw));
    } catch {
      keys.add(raw.replace(/^\//, ""));
    }
  }

  return [...keys];
}

function collectPhotoOriginalR2Keys(photo: PhotoR2CleanupSource): string[] {
  const keys = new Set<string>();
  const original = photo.originalKey
    ? resolveOriginalR2KeyFromStored(photo.originalKey)
    : null;
  if (original) keys.add(original);

  const previewFromUrl = resolvePreviewR2KeyFromPreviewUrl(photo.previewUrl);
  if (previewFromUrl?.includes("preview_")) {
    keys.add(previewFromUrl.replace("preview_", "original_"));
  }
  return [...keys];
}

/** Solo previews y variantes públicas (no el original en alta resolución). */
export function collectPhotoPreviewR2KeysForDeletion(photo: PhotoR2CleanupSource): string[] {
  const originals = new Set(collectPhotoOriginalR2Keys(photo));
  return collectPhotoR2KeysForDeletion(photo).filter((key) => !originals.has(key));
}

async function deletePhotoVariantPrefix(photoId: number): Promise<void> {
  const prefix = `photo-variants/${photoId}/`;
  try {
    const objects = await listObjectsByPrefix(prefix);
    for (const obj of objects) {
      if (obj.Key) await deleteFromR2(obj.Key).catch(() => {});
    }
  } catch {
    /* list/delete best-effort */
  }
}

export async function deletePhotoR2Assets(photo: PhotoR2CleanupSource): Promise<void> {
  for (const key of collectPhotoR2KeysForDeletion(photo)) {
    await deleteFromR2(key).catch(() => {});
  }
  if (photo.id != null && Number.isFinite(photo.id)) {
    await deletePhotoVariantPrefix(photo.id);
  }
}

export async function deletePhotoPublicPreviewAssets(
  photo: PhotoR2CleanupSource
): Promise<void> {
  for (const key of collectPhotoPreviewR2KeysForDeletion(photo)) {
    await deleteFromR2(key).catch(() => {});
  }
}
