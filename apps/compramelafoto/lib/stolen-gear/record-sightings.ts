import { prisma } from "@/lib/prisma";
import type { ExtractedExifMetadata } from "@/lib/photographic-equipment/extract-exif-metadata";
import { extractGearSerials } from "@repo/gear/exif";

type SightingInput = {
  photographerId: number;
  albumId: number;
  uploadedAt: Date;
  seenAt: Date;
  exif: ExtractedExifMetadata;
};

type OneSighting = {
  kind: "BODY" | "LENS";
  serialRaw: string;
  serialNormalized: string;
  make: string;
  model: string;
};

function pickSerials(exif: ExtractedExifMetadata): OneSighting[] {
  const out: OneSighting[] = [];
  const { bodySerial, lensSerial } = extractGearSerials(exif);
  if (bodySerial && exif.serialNumber) {
    out.push({
      kind: "BODY",
      serialRaw: String(exif.serialNumber).trim(),
      serialNormalized: bodySerial,
      make: exif.make?.trim() || "Desconocido",
      model: exif.model?.trim() || "Desconocido",
    });
  }
  const lensRaw = exif.rawExifSummary?.LensSerialNumber;
  if (lensSerial && lensRaw != null) {
    out.push({
      kind: "LENS",
      serialRaw: String(lensRaw).trim(),
      serialNormalized: lensSerial,
      make: exif.lensMake?.trim() || exif.make?.trim() || "Desconocido",
      model: exif.lensModel?.trim() || "Desconocido",
    });
  }
  return out;
}

/**
 * Suma una foto al historial permanente de números de serie (cámara y lente).
 * Nunca lanza: si falla, la lectura de EXIF sigue como si nada.
 */
export async function recordGearSerialSightings(input: SightingInput): Promise<void> {
  const sightings = pickSerials(input.exif);
  for (const s of sightings) {
    try {
      await prisma.$executeRaw`
        INSERT INTO "GearSerialSighting" (
          "kind", "serialNormalized", "serialRaw", "make", "model", "photographerId", "photographerLabel",
          "firstSeenAt", "lastSeenAt", "lastUploadedAt", "photosCount", "lastAlbumId", "lastAlbumTitle", "updatedAt"
        )
        SELECT ${s.kind}::"GearSerialKind", ${s.serialNormalized}, ${s.serialRaw}, ${s.make}, ${s.model},
               ${input.photographerId}::int,
               (SELECT COALESCE(NULLIF(u."name", ''), u."email") FROM "User" u WHERE u."id" = ${input.photographerId}::int),
               ${input.seenAt}, ${input.seenAt}, ${input.uploadedAt}, 1, ${input.albumId}::int,
               (SELECT a."title" FROM "Album" a WHERE a."id" = ${input.albumId}::int),
               CURRENT_TIMESTAMP
        ON CONFLICT ("kind", "serialNormalized", "photographerId") DO UPDATE SET
          "serialRaw"      = EXCLUDED."serialRaw",
          "make"           = EXCLUDED."make",
          "model"          = EXCLUDED."model",
          "firstSeenAt"    = LEAST("GearSerialSighting"."firstSeenAt", EXCLUDED."firstSeenAt"),
          "lastSeenAt"     = GREATEST("GearSerialSighting"."lastSeenAt", EXCLUDED."lastSeenAt"),
          "lastUploadedAt" = GREATEST("GearSerialSighting"."lastUploadedAt", EXCLUDED."lastUploadedAt"),
          "photosCount"    = "GearSerialSighting"."photosCount" + 1,
          "lastAlbumId"    = EXCLUDED."lastAlbumId",
          "lastAlbumTitle" = EXCLUDED."lastAlbumTitle",
          "updatedAt"      = CURRENT_TIMESTAMP
      `;
    } catch (error) {
      console.error("[stolen-gear] no se pudo registrar la serie", {
        kind: s.kind,
        photographerId: input.photographerId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
