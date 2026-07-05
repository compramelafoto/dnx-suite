/**
 * Regenera el ZIP de un pedido digital y reenvía email al cliente.
 *
 * Uso:
 *   npx tsx scripts/regenerate-order-zip-and-email.ts 1007
 *   SEND_EMAIL=1 npx tsx scripts/regenerate-order-zip-and-email.ts 1007
 */

import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

async function main() {
  const orderId = parseInt(process.argv[2] || "", 10);
  if (!Number.isFinite(orderId)) {
    console.error("Uso: npx tsx scripts/regenerate-order-zip-and-email.ts <orderId>");
    process.exit(1);
  }

  const { prisma } = await import("../lib/prisma");
  const { createZipJob, getZipExpiresAt } = await import("../lib/zip-job-queue");
  const { generateZipForJob } = await import("../lib/zip-generation");
  const { processEmailQueue } = await import("../lib/email-sender");

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      buyerEmail: true,
      albumId: true,
      status: true,
      items: {
        where: { productType: "DIGITAL" },
        select: { photoId: true },
      },
    },
  });

  if (!order) {
    throw new Error(`Pedido #${orderId} no encontrado`);
  }
  if (order.status !== "PAID") {
    throw new Error(`Pedido #${orderId} no está PAID (${order.status})`);
  }

  const photoIds = order.items
    .map((i) => i.photoId)
    .filter((id): id is number => Number.isFinite(id));

  if (photoIds.length === 0) {
    throw new Error(`Pedido #${orderId} sin ítems digitales`);
  }

  console.log(`[regen] Pedido #${orderId} → ${photoIds.length} digitales → ${order.buyerEmail}`);

  await prisma.zipGenerationJob.updateMany({
    where: {
      orderId,
      type: "ORDER_DOWNLOAD",
      status: { in: ["PENDING", "PROCESSING", "COMPLETED"] },
    },
    data: {
      status: "FAILED",
      error: "Reemplazado por regeneración manual",
    },
  });

  const job = await createZipJob({
    type: "ORDER_DOWNLOAD",
    orderId,
    albumId: order.albumId,
    photoIds,
    expiresAt: getZipExpiresAt(),
  });

  console.log(`[regen] Job creado: ${job.id}`);

  await generateZipForJob(job.id);

  const finished = await prisma.zipGenerationJob.findUnique({ where: { id: job.id } });
  if (!finished || finished.status !== "COMPLETED") {
    throw new Error(
      `Job falló: status=${finished?.status ?? "?"} error=${finished?.error ?? "?"}`
    );
  }

  console.log(`[regen] ZIP OK r2Key=${finished.r2Key}`);

  console.log("[regen] Email encolado por notifyClientDigitalZipReady (al completar job)");

  if (process.env.SEND_EMAIL === "1" || process.env.SEND_EMAIL_QA === "1") {
    const result = await processEmailQueue(5);
    console.log("[regen] processEmailQueue", result);
  } else {
    console.log("[regen] Tip: agregá SEND_EMAIL=1 para enviar vía Resend ahora");
  }

  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[regen] Error:", err);
  try {
    const { prisma } = await import("../lib/prisma");
    await prisma.$disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
