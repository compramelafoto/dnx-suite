/**
 * Regenera thumb/preview con marca para fotos recientes (pisa variantes existentes).
 * Pensado tras cambiar watermark.png, densidad del SVG o texto central del fotógrafo (PH : …).
 *
 * Uso:
 *   npx tsx scripts/reprocess-photo-watermarks-last-days.ts
 *   npx tsx scripts/reprocess-photo-watermarks-last-days.ts --apply
 *   npx tsx scripts/reprocess-photo-watermarks-last-days.ts --apply --days=7
 *   npx tsx scripts/reprocess-photo-watermarks-last-days.ts --apply --days=7 --batch=15 --sleep-ms=400
 *   npx tsx scripts/reprocess-photo-watermarks-last-days.ts --apply --photo-id=68133
 *
 * Requiere: DATABASE_URL, credenciales R2.
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { generatePersistPhotoVariants } from "../lib/images/generate-photo-variants";
import type { Prisma } from "@prisma/client";

const DEFAULT_DAYS = 7;
const PAGE_SIZE = 50;

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
  let days = DEFAULT_DAYS;
  let photoId: number | null = null;
  let batch = 15;
  let sleepMs = 300;
  let maxPhotos = 0;

  for (const arg of argv) {
    if (arg.startsWith("--days=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) days = n;
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
    if (arg.startsWith("--max=")) {
      const n = Number.parseInt(arg.split("=")[1] ?? "", 10);
      if (Number.isFinite(n) && n > 0) maxPhotos = n;
    }
  }

  return { apply, days, photoId, batch, sleepMs, maxPhotos };
}

function buildWhere(since: Date, photoId: number | null): Prisma.PhotoWhereInput {
  return {
    ...(photoId != null ? { id: photoId } : { createdAt: { gte: since } }),
    isRemoved: false,
    originalKey: { not: "" },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  assertR2EnvConfigured();

  const { apply, days, photoId, batch, sleepMs, maxPhotos } = parseArgs();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = buildWhere(since, photoId);

  const totalEligible = await prisma.photo.count({ where });
  console.log(
    JSON.stringify({
      event: "reprocess_watermarks_start",
      apply,
      days,
      since: since.toISOString(),
      photoId,
      batch,
      sleepMs,
      maxPhotos: maxPhotos || null,
      totalEligible,
      pageSize: PAGE_SIZE,
    })
  );

  if (!apply) {
    const sample = await prisma.photo.findMany({
      where,
      select: {
        id: true,
        albumId: true,
        createdAt: true,
        variantsStatus: true,
        variantsVersion: true,
        thumbWatermarkedKey: true,
        previewWatermarkedKey: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    console.log("Dry-run: agregá --apply para regenerar todas las fotos del rango.\n");
    for (const p of sample) {
      console.log(JSON.stringify(p));
    }
    if (totalEligible > sample.length) {
      console.log(`… y ${totalEligible - sample.length} fotos más en el rango.`);
    }
    return;
  }

  let cursor: number | undefined;
  let processed = 0;
  let ok = 0;
  let err = 0;

  while (true) {
    const photos = await prisma.photo.findMany({
      where,
      select: {
        id: true,
        albumId: true,
        previewUrl: true,
        originalKey: true,
        createdAt: true,
      },
      orderBy: { id: "asc" },
      take: PAGE_SIZE,
      ...(cursor != null ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (photos.length === 0) break;

    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      const log = await generatePersistPhotoVariants({
        photoId: p.id,
        albumId: p.albumId,
        previewUrl: p.previewUrl,
        originalKey: p.originalKey,
        createdAt: p.createdAt,
      });
      console.log(JSON.stringify({ event: "reprocess_watermark_photo", ...log }));
      processed++;
      if (log.status === "ok") ok++;
      else err++;

      if (maxPhotos > 0 && processed >= maxPhotos) {
        cursor = undefined;
        break;
      }

      const pause = sleepMs > 0 && (i + 1) % batch === 0;
      if (pause) await sleep(sleepMs);
    }

    if (maxPhotos > 0 && processed >= maxPhotos) break;

    cursor = photos[photos.length - 1]?.id;
    if (photos.length < PAGE_SIZE) break;
  }

  console.log(
    JSON.stringify({
      event: "reprocess_watermarks_done",
      processed,
      ok,
      error: err,
      totalEligible,
    })
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
