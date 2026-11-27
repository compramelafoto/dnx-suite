import { extractExifMetadata, extractGearSerials } from "@repo/gear/exif";
import { normalizeGearSerial } from "@repo/gear/serial";

export type UsageSealResult = {
  seal: "USAGE_VERIFIED" | "NONE";
  since: Date | null;
  photos: number | null;
  otherOwner: boolean;
};

export function computeUsageSeal(
  sightings: Array<{ photographerId: number | null; firstSeenAt: Date; photosCount: number }>,
  sellerId: number,
): UsageSealResult {
  const own = sightings.filter((s) => s.photographerId === sellerId);
  const otherOwner = sightings.some(
    (s) => s.photographerId !== null && s.photographerId !== sellerId,
  );
  if (own.length === 0) return { seal: "NONE", since: null, photos: null, otherOwner };
  const since = new Date(Math.min(...own.map((s) => s.firstSeenAt.getTime())));
  const photos = own.reduce((sum, s) => sum + s.photosCount, 0);
  return { seal: "USAGE_VERIFIED", since, photos, otherOwner };
}

/** ¿La serie leída de los metadatos de la foto (cuerpo o lente) es la declarada? */
export async function proofPhotoMatches(buffer: Buffer, serialNormalized: string): Promise<boolean> {
  const meta = await extractExifMetadata(buffer);
  if (!meta) return false;
  const target = normalizeGearSerial(serialNormalized);
  if (!target) return false;
  const { bodySerial, lensSerial } = extractGearSerials(meta);
  return [bodySerial, lensSerial].some((s) => s !== null && normalizeGearSerial(s) === target);
}
