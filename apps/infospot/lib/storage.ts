import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { generateR2Key, isR2Configured, uploadToR2 } from "@/lib/r2-client";

export const INFOSPOT_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const INFOSPOT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function validateInfoSpotImageFile(
  file: File,
): { ok: true } | { ok: false; error: string } {
  if (!INFOSPOT_IMAGE_ALLOWED_TYPES.includes(file.type as (typeof INFOSPOT_IMAGE_ALLOWED_TYPES)[number])) {
    return { ok: false, error: "Solo se permiten imágenes JPG, PNG o WebP" };
  }
  if (file.size > INFOSPOT_IMAGE_MAX_BYTES) {
    return { ok: false, error: "La imagen no puede superar 5 MB" };
  }
  return { ok: true };
}

/**
 * Sube portada editorial.
 * - Con R2 configurado: mismo bucket que CLF, prefix `infospot/covers`.
 * - Sin R2 (dev local): `public/uploads/infospot/`.
 */
export async function uploadInfoSpotCover(file: File): Promise<{
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
}> {
  const validation = validateInfoSpotImageFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = file.name || "cover.jpg";
  const mimeType = file.type || "image/jpeg";

  if (isR2Configured()) {
    const key = generateR2Key(filename, "infospot/covers");
    const { url } = await uploadToR2(buffer, key, mimeType, { type: "infospot_cover" });
    return { url, key, mimeType, sizeBytes: file.size, filename };
  }

  const ext = path.extname(filename) || ".jpg";
  const localName = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "infospot");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, localName), buffer);
  return {
    url: `/uploads/infospot/${localName}`,
    key: `uploads/infospot/${localName}`,
    mimeType,
    sizeBytes: file.size,
    filename,
  };
}

/** Portada de evento público — prefix `infospot/events`. */
export async function uploadInfoSpotEventCover(
  file: File,
  eventId?: string,
): Promise<{
  url: string;
  key: string;
  mimeType: string;
  sizeBytes: number;
  filename: string;
}> {
  const validation = validateInfoSpotImageFile(file);
  if (!validation.ok) throw new Error(validation.error);

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const filename = file.name || "event-cover.jpg";
  const mimeType = file.type || "image/jpeg";
  const prefix = eventId
    ? `infospot/events/${eventId}`
    : "infospot/events/pending";

  if (isR2Configured()) {
    const key = generateR2Key(filename, prefix);
    const { url } = await uploadToR2(buffer, key, mimeType, {
      type: "infospot_event_cover",
    });
    return { url, key, mimeType, sizeBytes: file.size, filename };
  }

  const ext = path.extname(filename) || ".jpg";
  const localName = `${randomUUID()}${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads", "infospot", "events");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, localName), buffer);
  return {
    url: `/uploads/infospot/events/${localName}`,
    key: `uploads/infospot/events/${localName}`,
    mimeType,
    sizeBytes: file.size,
    filename,
  };
}
