/**
 * Backfill de variantes públicas thumb/preview con marca (R2 + Photo.*WatermarkedKey).
 *
 * Por defecto solo fotos de los últimos 20 días. No modifica originalKey ni previewUrl.
 *
 * Uso:
 *   npx tsx scripts/backfill-photo-variants.ts
 *   npx tsx scripts/backfill-photo-variants.ts --apply
 *   npx tsx scripts/backfill-photo-variants.ts --apply --days=30
 *   npx tsx scripts/backfill-photo-variants.ts --apply --missing-only
 *   npx tsx scripts/backfill-photo-variants.ts --apply --retry-failed
 *   npx tsx scripts/backfill-photo-variants.ts --apply --missing-only --retry-failed
 *   npx tsx scripts/backfill-photo-variants.ts --apply --limit=5
 *   npx tsx scripts/backfill-photo-variants.ts --apply --photo-id=68133
 *   npx tsx scripts/backfill-photo-variants.ts --apply --retry-failed --batch=20 --sleep-ms=300
 *
 * Requiere: DATABASE_URL, credenciales R2.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { generatePersistPhotoVariants } from "../lib/images/generate-photo-variants";
import type { PhotoVariantsStatus, Prisma } from "@prisma/client";

const DEFAULT_DAYS = 20;

function assertR2EnvConfigured(): void {
  const missing: string[] = [];
  for (const key of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_ENDPOINT",
  ]) {
    if (!process.env[key]?.trim()) missing.push(key);
  }
  if (!process.env.R2_BUCKET_NAME?.trim() && !process.env.R2_BUCKET?.trim()) {
    missing.push("R2_BUCKET_NAME or R2_BUCKET");
  }
  if (missing.length > 0) {
    console.error("R2 environment variables missing");
    process.exit(1);
  }
}

function parseArgs() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const missingOnly = argv.includes("--missing-only");
  const retryFailed = argv.includes("--retry-failed");
  let days = DEFAULT_DAYS;
  let limit = 200;
  let photoId: number | null = null;
  let batch = 0;
  let sleepMs = 0;

  for (const arg of argv) {
    if (arg.startsWith("--days=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) days = n;
    }
    if (arg.startsWith("--limit=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) limit = n;
    }
    if (arg.startsWith("--photo-id=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(n)) photoId = n;
    }
    if (arg.startsWith("--batch=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) batch = n;
    }
    if (arg.startsWith("--sleep-ms=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(n) && n >= 0) sleepMs = n;
    }
  }

  return { apply, missingOnly, retryFailed, days, limit, photoId, batch, sleepMs };
}

function buildPhotoWhere(params: {
  missingOnly: boolean;
  retryFailed: boolean;
  since: Date;
  photoId: number | null;
}): Prisma.PhotoWhereInput {
  const base: Prisma.PhotoWhereInput = {
    ...(params.photoId != null ? { id: params.photoId } : { createdAt: { gte: params.since } }),
    isRemoved: false,
    originalKey: { not: "" },
  };

  if (params.retryFailed && params.missingOnly) {
    return {
      ...base,
      variantsStatus: { in: ["PENDING", "FAILED"] },
      OR: [
        { variantsStatus: "FAILED" },
        { thumbWatermarkedKey: null },
        { previewWatermarkedKey: null },
      ],
    };
  }

  if (params.retryFailed) {
    return {
      ...base,
      variantsStatus: "FAILED",
    };
  }

  if (params.missingOnly) {
    return {
      ...base,
      variantsStatus: { in: ["PENDING", "FAILED"] },
      OR: [{ thumbWatermarkedKey: null }, { previewWatermarkedKey: null }],
    };
  }

  return base;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  assertR2EnvConfigured();

  const { apply, missingOnly, retryFailed, days, limit, photoId, batch, sleepMs } = parseArgs();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const photos = await prisma.photo.findMany({
    where: buildPhotoWhere({ missingOnly, retryFailed, since, photoId }),
    select: {
      id: true,
      albumId: true,
      previewUrl: true,
      originalKey: true,
      createdAt: true,
      variantsStatus: true,
      thumbWatermarkedKey: true,
      previewWatermarkedKey: true,
      variantsError: true,
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  console.log(
    JSON.stringify({
      event: "backfill_photo_variants_start",
      apply,
      missingOnly,
      retryFailed,
      days,
      limit,
      photoId,
      batch: batch || null,
      sleepMs: sleepMs || null,
      since: since.toISOString(),
      count: photos.length,
    })
  );

  if (!apply) {
    console.log("Dry-run: pasá --apply para generar y subir variantes.\n");
    for (const p of photos) {
      console.log(
        JSON.stringify({
          photoId: p.id,
          albumId: p.albumId,
          previewUrl: p.previewUrl?.slice(0, 120) ?? null,
          originalKey: p.originalKey?.slice(0, 120) ?? null,
          variantsStatus: p.variantsStatus,
          hasThumb: Boolean(p.thumbWatermarkedKey),
          hasPreview: Boolean(p.previewWatermarkedKey),
          variantsError: p.variantsError ? p.variantsError.slice(0, 120) : null,
        })
      );
    }
    return;
  }

  let ok = 0;
  let err = 0;
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const log = await generatePersistPhotoVariants({
      photoId: p.id,
      albumId: p.albumId,
      previewUrl: p.previewUrl,
      originalKey: p.originalKey,
      createdAt: p.createdAt,
    });
    console.log(JSON.stringify({ event: "backfill_photo_variant", ...log }));
    if (log.status === "ok") ok++;
    else err++;

    const pause = sleepMs > 0 && (batch <= 0 || (i + 1) % batch === 0);
    if (pause && i < photos.length - 1) {
      await sleep(sleepMs);
    }
  }

  console.log(
    JSON.stringify({
      event: "backfill_photo_variants_done",
      processed: photos.length,
      ok,
      error: err,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
