/**
 * Lógica compartida para regenerar ZIPs y reenviar emails de descarga
 * para pedidos con ítems digitales (incluido "digital con impresión").
 *
 * Usado por:
 * - scripts/regenerate-order-zips-last-48h.ts
 * - api/cron/regenerate-zips-last-48h/route.ts
 */

import { prisma } from "@/lib/prisma";
import {
  createZipJob,
  getZipExpiresAt,
  getNextPendingJobs,
} from "@/lib/zip-job-queue";
import { generateZipForJob } from "@/lib/zip-generation";
import {
  createClientDownloadToken,
  getOrderDownloadTokens,
} from "@/lib/download-tokens";
import { getAppConfig } from "@/lib/services/settingsService";

export type RegenerateResult = {
  fixedItems: number;
  jobsReset: number;
  jobsCreated: number;
  processed: number;
  failed: number;
  failedOrderIds: number[];
};

/**
 * Regenera ZIPs y reenvía emails para pedidos PAID de las últimas N horas
 * que tienen ítems digitales (incluido "digital incluido con impresión").
 */
export async function regenerateOrderZipsLastNHours(
  hours: number = 48,
  processInline: boolean = true
): Promise<RegenerateResult> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  // Resetear jobs FAILED de pedidos en las últimas N horas para reintentarlos
  const orderIdsInWindow = await prisma.order.findMany({
    where: { status: "PAID", createdAt: { gte: since } },
    select: { id: true },
  });
  const orderIds = orderIdsInWindow.map((o) => o.id);
  let jobsReset = 0;
  if (orderIds.length > 0) {
    const resetResult = await prisma.zipGenerationJob.updateMany({
      where: {
        status: "FAILED",
        type: "ORDER_DOWNLOAD",
        orderId: { in: orderIds },
      },
      data: {
        status: "PENDING",
        error: null,
        startedAt: null,
        finishedAt: null,
      },
    });
    jobsReset = resetResult.count;
  }

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: since },
    },
    include: {
      items: { select: { id: true, photoId: true, productType: true } },
    },
    orderBy: { id: "asc" },
  });

  let fixedItems = 0;

  // 1. Corregir OrderItems DIGITAL faltantes (caso "incluido con impresión")
  for (const order of orders) {
    const snapshot = order.pricingSnapshot as
      | { items?: Array<{ component?: string; inputIndex?: number }> }
      | null;
    const hasDigitalInSnapshot = snapshot?.items?.some(
      (i) => i.component === "DIGITAL"
    );
    const hasDigitalItem = order.items.some((i) => i.productType === "DIGITAL");

    if (hasDigitalInSnapshot && !hasDigitalItem) {
      const printItem = order.items.find((i) => i.productType === "PRINT");
      if (printItem) {
        await prisma.orderItem.create({
          data: {
            orderId: order.id,
            photoId: printItem.photoId,
            productType: "DIGITAL",
            quantity: 1,
            priceCents: 0,
            subtotalCents: 0,
          },
        });
        fixedItems += 1;
      }
    }
  }

  const ordersWithDigital = await prisma.order.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: since },
      items: { some: { productType: "DIGITAL" } },
    },
    include: {
      items: {
        where: { productType: "DIGITAL" },
        select: { photoId: true },
      },
    },
  });

  const expiresAt = getZipExpiresAt();
  const config = await getAppConfig();
  const downloadDays = Number(config?.downloadLinkDays ?? 30) || 30;
  const tokenExpiresAt = new Date(
    Date.now() + downloadDays * 24 * 60 * 60 * 1000
  );

  let jobsCreated = 0;

  // 2. Crear ZipGenerationJobs (y tokens si faltan)
  for (const order of ordersWithDigital) {
    const photoIds = order.items
      .map((i) => i.photoId)
      .filter((id) => Number.isFinite(id));
    if (photoIds.length === 0) continue;

    // No crear job si ya hay uno PENDING (p. ej. recién reseteado desde FAILED)
    const existingPending = await prisma.zipGenerationJob.findFirst({
      where: {
        orderId: order.id,
        type: "ORDER_DOWNLOAD",
        status: "PENDING",
      },
    });
    if (existingPending) continue;

    const tokens = await getOrderDownloadTokens(order.id);
    const hasToken = tokens.some((t) => t.type === "CLIENT_DIGITAL" && !t.photoId);
    if (!hasToken) {
      await createClientDownloadToken({
        orderId: order.id,
        albumId: order.albumId,
        expiresAt: tokenExpiresAt,
      });
    }

    await createZipJob({
      type: "ORDER_DOWNLOAD",
      orderId: order.id,
      albumId: order.albumId,
      photoIds,
      expiresAt,
    });
    jobsCreated += 1;
  }

  let processed = 0;
  let failed = 0;
  const failedOrderIds: number[] = [];

  if (processInline && jobsCreated > 0) {
    for (let i = 0; i < 100; i++) {
      const jobs = await getNextPendingJobs(5);
      if (jobs.length === 0) break;

      for (const job of jobs) {
        try {
          await generateZipForJob(job.id);
          processed += 1;
        } catch (err: unknown) {
          failed += 1;
          if (job.orderId) failedOrderIds.push(job.orderId);
        }
      }
    }
  }

  return {
    fixedItems,
    jobsReset,
    jobsCreated,
    processed,
    failed,
    failedOrderIds,
  };
}
