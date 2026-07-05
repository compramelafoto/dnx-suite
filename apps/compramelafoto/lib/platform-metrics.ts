import { prisma } from "@/lib/prisma";

const METRICS_ID = 1;

/**
 * Incrementa el contador histórico de fotos subidas (nunca decrece).
 * Llamar en cada `photo.create` de producción.
 */
export async function incrementPhotosUploaded(count = 1): Promise<void> {
  if (count <= 0) return;
  await prisma.platformMetrics.upsert({
    where: { id: METRICS_ID },
    create: { id: METRICS_ID, photosUploadedTotal: BigInt(count) },
    update: { photosUploadedTotal: { increment: BigInt(count) } },
  });
}

/**
 * Total histórico de fotos subidas (incluye las ya purgadas o eliminadas de BD).
 */
export async function getPhotosUploadedTotal(): Promise<number> {
  const row = await prisma.platformMetrics.findUnique({
    where: { id: METRICS_ID },
    select: { photosUploadedTotal: true },
  });
  if (row) return Number(row.photosUploadedTotal);

  const fallback = await prisma.photo.count();
  await prisma.platformMetrics.upsert({
    where: { id: METRICS_ID },
    create: { id: METRICS_ID, photosUploadedTotal: BigInt(fallback) },
    update: {},
  });
  return fallback;
}
