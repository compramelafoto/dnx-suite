/**
 * Reenvía emails de descarga digital para pedidos PAID de las últimas N horas
 * que tienen ítems digitales y token de descarga.
 */

import { prisma } from "@/lib/prisma";
import { resendDigitalDownloadEmailForOrder } from "@/lib/zip-job-notifications";

export type ResendEmailsResult = {
  total: number;
  queued: number;
  skipped: number;
  errors: Array<{ orderId: number; error: string }>;
};

export async function resendDigitalDownloadEmailsLastNHours(
  hours: number = 48
): Promise<ResendEmailsResult> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const orders = await prisma.order.findMany({
    where: {
      status: "PAID",
      createdAt: { gte: since },
      items: { some: { productType: "DIGITAL" } },
    },
    select: { id: true },
    orderBy: { id: "asc" },
  });

  const result: ResendEmailsResult = {
    total: orders.length,
    queued: 0,
    skipped: 0,
    errors: [],
  };

  for (const order of orders) {
    const { queued, error } = await resendDigitalDownloadEmailForOrder(order.id);
    if (error) {
      result.errors.push({ orderId: order.id, error });
    } else if (queued) {
      result.queued += 1;
    } else {
      result.skipped += 1;
    }
  }

  return result;
}
