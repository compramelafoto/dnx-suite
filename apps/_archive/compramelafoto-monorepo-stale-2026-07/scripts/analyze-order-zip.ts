/**
 * Analiza por qué un pedido no generó ZIP.
 * Uso: npx tsx scripts/analyze-order-zip.ts 247
 */

import { prisma } from "../lib/prisma";

const ORDER_ID = parseInt(process.argv[2] || "247", 10);

async function main() {
  console.log(`\n=== Análisis pedido #${ORDER_ID} (ZIP) ===\n`);

  // 1. ¿Es Order (álbum) o PrintOrder (impresión)?
  const [albumOrder, printOrder] = await Promise.all([
    prisma.order.findUnique({
      where: { id: ORDER_ID },
      include: {
        items: { select: { id: true, photoId: true, productType: true } },
        album: { select: { id: true, title: true } },
      },
    }),
    prisma.printOrder.findUnique({
      where: { id: ORDER_ID },
      select: { id: true, orderType: true, paymentStatus: true },
    }),
  ]);

  if (albumOrder) {
    console.log("Tipo: ORDER (pedido de álbum)");
    console.log("Estado:", albumOrder.status);
    console.log("Álbum:", albumOrder.album?.title ?? albumOrder.albumId);
    console.log("Items:", albumOrder.items.length);

    const digitalItems = albumOrder.items.filter((i) => i.productType === "DIGITAL");
    const printItems = albumOrder.items.filter((i) => i.productType !== "DIGITAL");

    console.log("  - Digitales:", digitalItems.length);
    console.log("  - Impresión/otros:", printItems.length);

    if (digitalItems.length === 0) {
      console.log("\n⚠️  CAUSA: Este pedido NO tiene ítems digitales.");
      console.log("   El ZIP solo se genera para pedidos con fotos digitales.");
      if (printItems.length > 0) {
        console.log("   Solo tiene ítems de impresión, no hay descarga digital.");
      }
      return;
    }

    const photoIds = digitalItems.map((i) => i.photoId).filter((id) => Number.isFinite(id));
    console.log("\nPhotoIds en ítems digitales:", photoIds);

    // Verificar fotos
    const photos = await prisma.photo.findMany({
      where: { id: { in: photoIds } },
      select: { id: true, originalKey: true, isRemoved: true },
    });

    const missingKey = photos.filter((p) => !p.originalKey?.trim());
    const removed = photos.filter((p) => p.isRemoved);

    if (missingKey.length > 0) {
      console.log("\n⚠️  CAUSA: Fotos sin originalKey:", missingKey.map((p) => p.id).join(", "));
      console.log("   El ZIP falla si alguna foto no tiene originalKey en R2.");
    }
    if (removed.length > 0) {
      console.log("\n⚠️  Fotos removidas del álbum:", removed.map((p) => p.id).join(", "));
    }

    // ZipGenerationJobs
    const zipJobs = await prisma.zipGenerationJob.findMany({
      where: { orderId: ORDER_ID },
      orderBy: { createdAt: "desc" },
    });

    console.log("\nZipGenerationJobs:", zipJobs.length);
    zipJobs.forEach((j, i) => {
      console.log(`  ${i + 1}. id=${j.id} status=${j.status} createdAt=${j.createdAt.toISOString()}`);
      if (j.error) console.log(`     error: ${j.error}`);
      if (j.photoIds?.length) console.log(`     photoIds: ${j.photoIds.length}`);
    });

    if (zipJobs.length === 0) {
      console.log("\n⚠️  CAUSA: No se creó ningún ZipGenerationJob.");
      console.log("   Posibles razones:");
      console.log("   - ensureDigitalDelivery no se ejecutó (webhook no llegó o falló antes)");
      console.log("   - El pago se aprobó por otro flujo que no llama ensureDigitalDelivery");
      console.log("   - El Order se marcó PAID antes de que existiera ensureDigitalDelivery");
    } else {
      const failed = zipJobs.find((j) => j.status === "FAILED");
      const pending = zipJobs.find((j) => j.status === "PENDING" || j.status === "PROCESSING");
      const completed = zipJobs.find((j) => j.status === "COMPLETED");

      if (failed) {
        console.log("\n⚠️  CAUSA: El job falló:", failed.error);
      } else if (pending) {
        console.log("\n⚠️  CAUSA: El job está PENDING o PROCESSING.");
        console.log("   El cron process-zip-jobs debería procesarlo. Verificá que el cron esté activo.");
      } else if (completed) {
        console.log("\n✓ Job completado. El ZIP debería estar disponible.");
        const last = zipJobs[0];
        if (last.zipUrl) console.log("   zipUrl generada (presigned).");
      }
    }

    // Tokens de descarga
    const tokens = await prisma.orderDownloadToken.findMany({
      where: { orderId: ORDER_ID, type: "CLIENT_DIGITAL" },
    });
    console.log("\nOrderDownloadToken (CLIENT_DIGITAL):", tokens.length);
    if (tokens.length > 0) {
      const valid = tokens.filter((t) => t.expiresAt > new Date());
      console.log("  Válidos (no vencidos):", valid.length);
    }
  } else if (printOrder) {
    console.log("Tipo: PRINT_ORDER (pedido de impresión)");
    console.log("Estado pago:", printOrder.paymentStatus);
    console.log("\n⚠️  Los pedidos de impresión (PrintOrder) NO generan ZIP de descarga digital.");
    console.log("   El ZIP solo se genera para Order (pedidos de álbum con fotos digitales).");
  } else {
    console.log("No se encontró Order ni PrintOrder con id", ORDER_ID);
  }

  console.log("\n=== Fin análisis ===\n");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
