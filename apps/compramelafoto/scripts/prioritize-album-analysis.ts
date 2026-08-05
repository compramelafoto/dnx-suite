/**
 * Crea jobs faltantes y prioriza el análisis de un álbum (frente del FIFO).
 *
 * Uso:
 *   npx tsx scripts/prioritize-album-analysis.ts 749
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

config({ path: ".env.production.local" });
config({ path: ".env.local" });

const albumId = Number(process.argv[2] || "");
const prisma = new PrismaClient();

async function main() {
  if (!Number.isFinite(albumId)) {
    throw new Error("Uso: npx tsx scripts/prioritize-album-analysis.ts <albumId>");
  }

  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: { id: true, title: true, publicSlug: true },
  });
  if (!album) throw new Error(`Álbum ${albumId} no encontrado`);
  console.log("ALBUM", album);

  const photos = await prisma.photo.findMany({
    where: { albumId, isRemoved: false },
    select: { id: true },
  });
  console.log(`photos=${photos.length}`);

  const existing = await prisma.photoAnalysisJob.findMany({
    where: { photoId: { in: photos.map((p) => p.id) } },
    select: { photoId: true },
  });
  const existingByPhoto = new Set(existing.map((j) => j.photoId));
  const missing = photos.filter((p) => !existingByPhoto.has(p.id));
  console.log(`jobs_existing=${existing.length} jobs_missing=${missing.length}`);

  const chunk = 500;
  for (let i = 0; i < missing.length; i += chunk) {
    const slice = missing.slice(i, i + chunk);
    await prisma.photoAnalysisJob.createMany({
      data: slice.map((p) => ({ photoId: p.id, status: "PENDING" as const })),
      skipDuplicates: true,
    });
    console.log(`created jobs ${i + 1}-${Math.min(i + chunk, missing.length)}`);
  }

  const prioritizedAt = new Date("2000-01-01T00:00:00.000Z");
  const updated = await prisma.$executeRaw`
    UPDATE "PhotoAnalysisJob" j
    SET
      status = 'PENDING',
      "createdAt" = ${prioritizedAt},
      "runAfter" = NULL,
      "lockedAt" = NULL,
      "updatedAt" = NOW()
    FROM "Photo" p
    WHERE j."photoId" = p.id
      AND p."albumId" = ${albumId}
      AND p."isRemoved" = false
      AND j.status IN ('PENDING', 'PROCESSING')
  `;
  console.log(`prioritized_rows=${updated}`);

  await prisma.photo.updateMany({
    where: {
      albumId,
      isRemoved: false,
      analysisStatus: { in: ["PENDING", "PROCESSING"] },
    },
    data: { analysisError: null },
  });

  const byStatus = await prisma.$queryRawUnsafe<Array<{ status: string; c: number }>>(
    `
    SELECT j.status::text as status, count(*)::int as c
    FROM "PhotoAnalysisJob" j
    JOIN "Photo" p ON p.id = j."photoId"
    WHERE p."albumId" = $1 AND p."isRemoved" = false
    GROUP BY 1
    ORDER BY 1
    `,
    albumId
  );
  console.log("JOB_STATUS", byStatus);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
