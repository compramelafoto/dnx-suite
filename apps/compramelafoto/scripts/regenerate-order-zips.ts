/**
 * Regenera jobs de ZIP para todos los pedidos que tienen ítems digitales.
 * Cada job se procesa por el cron (api/cron/process-zip-jobs); al completar
 * se envía el email de descarga al cliente (notifyClientDigitalZipReady).
 *
 * Uso:
 *   npx tsx scripts/regenerate-order-zips.ts
 *
 * Después de ejecutar, disparar el procesamiento de jobs:
 *   - Cron: si tenés Vercel Cron, se ejecutará solo.
 *   - Manual: POST/GET a /api/cron/process-zip-jobs con CRON_SECRET (procesa 5 por vez).
 */

import { prisma } from "../lib/prisma";
import { createZipJob, getZipExpiresAt } from "../lib/zip-job-queue";

async function main() {
  const orders = await prisma.order.findMany({
    where: {
      items: {
        some: { productType: "DIGITAL" },
      },
    },
    include: {
      items: {
        where: { productType: "DIGITAL" },
        select: { photoId: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const photoIdsByOrder = orders.map((o) => ({
    orderId: o.id,
    albumId: o.albumId,
    photoIds: o.items.map((i) => i.photoId).filter((id) => Number.isFinite(id)),
  }));

  const withPhotos = photoIdsByOrder.filter((p) => p.photoIds.length > 0);
  if (withPhotos.length === 0) {
    console.log("No hay pedidos con ítems digitales con fotos. Nada que hacer.");
    process.exit(0);
    return;
  }

  const expiresAt = getZipExpiresAt();
  let created = 0;
  let skipped = 0;

  for (const { orderId, albumId, photoIds } of withPhotos) {
    const existing = await prisma.zipGenerationJob.findFirst({
      where: {
        orderId,
        type: "ORDER_DOWNLOAD",
        status: { in: ["PENDING", "PROCESSING"] },
      },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await createZipJob({
      type: "ORDER_DOWNLOAD",
      orderId,
      albumId,
      photoIds,
      expiresAt,
    });
    created += 1;
    console.log(`Creado job ZIP para pedido ${orderId} (${photoIds.length} fotos)`);
  }

  console.log(`\nResumen: ${created} jobs creados, ${skipped} pedidos ya tenían job pendiente.`);
  console.log(
    "Para procesar: ejecutá el cron (process-zip-jobs) o esperá a que se ejecute; cada job completado reenviará el email al cliente."
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
