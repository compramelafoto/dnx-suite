/**
 * Rehace los previews en R2: lee el JPEG **original** (sin marca), aplica la marca de agua **actual**
 * del código (`buildWatermarkedPreviewJpegFromOriginalBuffer`) y **sobrescribe** el mismo `previewKey`.
 * Así se elimina cualquier marca vieja del preview guardado y queda alineado con `lib/image-processing.ts`.
 * Los originales en R2 no se modifican.
 *
 * Criterio por defecto: Photo.createdAt >= ahora - N días (fotos subidas en la ventana).
 * Opcional: filtrar por álbum o foto individual.
 *
 * Uso:
 *   npm run regenerate:watermarks
 *   npm run regenerate:watermarks -- 14
 *   npx tsx scripts/regenerate-watermarks-last-7-days.ts --days=30 --album=12
 *   npx tsx scripts/regenerate-watermarks-last-7-days.ts --photo=8392
 *
 * Requiere .env con DATABASE_URL y credenciales R2.
 */

import "dotenv/config";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { readFromR2, uploadToR2, urlToR2Key } from "../lib/r2-client";
import { buildWatermarkedPreviewJpegFromOriginalBuffer } from "../lib/image-processing";

function originalKeyToR2Key(raw: string | null | undefined): string {
  const t = (raw ?? "").trim();
  if (!t) throw new Error("originalKey vacío");
  if (t.startsWith("http://") || t.startsWith("https://") || t.startsWith("/uploads/")) {
    return urlToR2Key(t);
  }
  return t.replace(/^\//, "");
}

function parseArgs() {
  const argv = process.argv.slice(2);
  let days = 7;
  let albumId: number | undefined;
  let photoId: number | undefined;
  for (const a of argv) {
    if (a.startsWith("--days=")) days = Math.max(1, parseInt(a.split("=")[1], 10) || 7);
    else if (a.startsWith("--album=")) albumId = parseInt(a.split("=")[1], 10);
    else if (a.startsWith("--photo=")) photoId = parseInt(a.split("=")[1], 10);
    else if (/^\d+$/.test(a)) days = Math.max(1, parseInt(a, 10));
  }
  return { days, albumId, photoId };
}

async function main() {
  const { days, albumId, photoId } = parseArgs();
  const since = new Date();
  since.setDate(since.getDate() - days);

  const where: Prisma.PhotoWhereInput = { isRemoved: false };
  if (Number.isFinite(photoId as number)) {
    where.id = photoId!;
  } else {
    where.createdAt = { gte: since };
    if (Number.isFinite(albumId as number)) where.albumId = albumId!;
  }

  const photos = await prisma.photo.findMany({
    where,
    select: {
      id: true,
      albumId: true,
      userId: true,
      originalKey: true,
      previewUrl: true,
      createdAt: true,
    },
    orderBy: { id: "asc" },
  });

  const criterio =
    Number.isFinite(photoId as number)
      ? "Photo.id = --photo (sin filtro de fecha)"
      : `Photo.createdAt >= cutoff${Number.isFinite(albumId as number) ? " AND albumId = --album" : ""}`;
  console.log(
    JSON.stringify(
      {
        criterio,
        cutoffISO: Number.isFinite(photoId as number) ? null : since.toISOString(),
        days: Number.isFinite(photoId as number) ? null : days,
        albumId: albumId ?? null,
        photoId: photoId ?? null,
        count: photos.length,
      },
      null,
      2
    )
  );

  let ok = 0;
  let fail = 0;
  for (const p of photos) {
    try {
      const original = await readFromR2(originalKeyToR2Key(p.originalKey));
      const previewKey = urlToR2Key(p.previewUrl);
      const jpeg = await buildWatermarkedPreviewJpegFromOriginalBuffer(original, true, p.id);
      await uploadToR2(jpeg, previewKey, "image/jpeg", {
        type: "preview",
        originalName: `photo-${p.id}.jpg`,
      });
      ok++;
      console.log(`OK photoId=${p.id} key=${previewKey}`);
    } catch (e: any) {
      fail++;
      console.error(`FAIL photoId=${p.id}`, e?.message || e);
    }
  }

  console.log(`\nListo. OK=${ok} FAIL=${fail}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
