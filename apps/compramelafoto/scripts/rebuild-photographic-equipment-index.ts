/**
 * Reconstruye índices derivados del módulo equipos (v2).
 * NO modifica fotos, álbumes, pedidos ni storage.
 *
 * Uso:
 *   npx tsx scripts/rebuild-photographic-equipment-index.ts --dry-run
 *   npx tsx scripts/rebuild-photographic-equipment-index.ts --photographerId 42 --limit 500
 *   npx tsx scripts/rebuild-photographic-equipment-index.ts --reextract
 */

import type { PhotoExifMetadataStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAlbumEligibleForExifScan } from "@/lib/album-cleanup/eligibility";
import { hasUsefulDeviceData } from "@/lib/photographic-equipment/device-inference";
import { extractExifMetadata } from "@/lib/photographic-equipment/extract-exif-metadata";
import { upsertGearFromObservation } from "@/lib/photographic-equipment/upsert-gear";
import { readFromR2, urlToR2Key } from "@/lib/r2-client";

function parseArgs(argv: string[]) {
  const dryRun = argv.includes("--dry-run");
  const reextract = argv.includes("--reextract");
  const photographerIdIdx = argv.indexOf("--photographerId");
  const limitIdx = argv.indexOf("--limit");
  const photographerId =
    photographerIdIdx >= 0 && argv[photographerIdIdx + 1]
      ? Number.parseInt(argv[photographerIdIdx + 1], 10)
      : null;
  const limit =
    limitIdx >= 0 && argv[limitIdx + 1]
      ? Math.max(1, Number.parseInt(argv[limitIdx + 1], 10) || 1000)
      : null;
  return {
    dryRun,
    reextract,
    photographerId: Number.isFinite(photographerId) ? photographerId : null,
    limit,
  };
}

function resolveOriginalKey(originalKey: string): string {
  try {
    return urlToR2Key(originalKey);
  } catch {
    return originalKey.replace(/^\//, "");
  }
}

async function clearGearIndices(photographerId: number | null, dryRun: boolean) {
  const where = photographerId ? { photographerId } : {};
  const counts = {
    observations: await prisma.photographicGearObservation.count({ where }),
    combinations: await prisma.photographicGearCombination.count({ where }),
    lenses: await prisma.photographicLens.count({ where }),
    bodies: await prisma.photographicCameraBody.count({ where }),
  };
  console.log("Índices a borrar:", counts);
  if (dryRun) return counts;

  await prisma.photographicGearObservation.deleteMany({ where });
  await prisma.photographicGearCombination.deleteMany({ where });
  await prisma.photographicLens.deleteMany({ where });
  await prisma.photographicCameraBody.deleteMany({ where });
  return counts;
}

async function main() {
  const { dryRun, reextract, photographerId, limit } = parseArgs(process.argv.slice(2));

  console.log("=== Rebuild índices Equipos Fotográficos ===");
  console.log({ dryRun, reextract, photographerId, limit });

  await clearGearIndices(photographerId, dryRun);
  if (dryRun) {
    console.log("\n--dry-run: no se reconstruyó nada.");
    return;
  }

  const photos = await prisma.photo.findMany({
    where: {
      exifMetadataStatus: "ANALYZED" satisfies PhotoExifMetadataStatus,
      isRemoved: false,
      storageDeletedAt: null,
      ...(photographerId
        ? { OR: [{ userId: photographerId }, { album: { userId: photographerId } }] }
        : {}),
      album: {
        deletedAt: null,
        isHidden: false,
      },
    },
    orderBy: { id: "asc" },
    take: limit ?? undefined,
    select: {
      id: true,
      albumId: true,
      userId: true,
      originalKey: true,
      createdAt: true,
      capturedAt: true,
      storageDeletedAt: true,
      album: {
        select: {
          userId: true,
          deletedAt: true,
          isHidden: true,
          firstPhotoDate: true,
          expirationExtensionDays: true,
          cleanupStatus: true,
        },
      },
      exifMetadata: {
        select: {
          make: true,
          model: true,
          serialNumber: true,
          lensMake: true,
          lensModel: true,
          takenAt: true,
        },
      },
    },
  });

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (const photo of photos) {
    if (!isAlbumEligibleForExifScan(photo.album)) {
      skipped += 1;
      continue;
    }
    if (photo.storageDeletedAt || photo.originalKey.startsWith("purged/")) {
      skipped += 1;
      continue;
    }

    const meta = photo.exifMetadata;
    if (!meta) {
      skipped += 1;
      continue;
    }

    const photographerIdResolved = photo.userId ?? photo.album.userId;

    try {
      let exif = null;
      if (reextract) {
        const buffer = await readFromR2(resolveOriginalKey(photo.originalKey));
        exif = await extractExifMetadata(buffer);
      } else {
        if (!hasUsefulDeviceData(meta.make, meta.model, meta.serialNumber)) {
          skipped += 1;
          continue;
        }
        exif = {
          make: meta.make,
          model: meta.model,
          serialNumber: meta.serialNumber,
          lensMake: meta.lensMake,
          lensModel: meta.lensModel,
          focalLength: null,
          exposureTime: null,
          aperture: null,
          iso: null,
          takenAt: meta.takenAt ?? photo.capturedAt,
          gpsLat: null,
          gpsLng: null,
          shutterCount: null,
          rawExifSummary: {},
        };
      }

      if (!exif || !hasUsefulDeviceData(exif.make, exif.model, exif.serialNumber)) {
        skipped += 1;
        continue;
      }

      const seenAt = exif.takenAt ?? photo.capturedAt ?? photo.createdAt;
      await upsertGearFromObservation({
        photographerId: photographerIdResolved,
        photoId: photo.id,
        albumId: photo.albumId,
        uploadedAt: photo.createdAt,
        exif,
        seenAt,
      });
      processed += 1;
      if (processed % 100 === 0) console.log(`  … ${processed} reconstruidas`);
    } catch (err) {
      errors += 1;
      console.warn(`Error foto #${photo.id}:`, err);
    }
  }

  console.log("\nResultado:");
  console.log(`  Procesadas: ${processed}`);
  console.log(`  Omitidas:   ${skipped}`);
  console.log(`  Errores:    ${errors}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
