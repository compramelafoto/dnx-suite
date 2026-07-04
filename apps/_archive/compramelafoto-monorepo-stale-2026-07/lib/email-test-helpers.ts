import { prisma } from "@/lib/prisma";

export type TemplateData = Record<string, string | number | boolean | null>;

export async function buildTemplateDataFromOrder(params: {
  orderId: number;
  type: "ALBUM" | "PRINT";
}): Promise<TemplateData | null> {
  if (params.type === "PRINT") {
    const printOrder = await prisma.printOrder.findUnique({
      where: { id: params.orderId },
      include: {
        photographer: { select: { id: true, name: true, email: true } },
      },
    });
    if (!printOrder) return null;
    return {
      orderId: printOrder.id,
      orderType: "PRINT",
      total: printOrder.total,
      customerName: printOrder.customerName ?? null,
      customerEmail: printOrder.customerEmail ?? null,
      photographerName: printOrder.photographer?.name ?? null,
      albumTitle: null,
      albumSlug: null,
      createdAt: printOrder.createdAt.toISOString(),
    };
  }

  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      album: { select: { id: true, title: true, publicSlug: true } },
    },
  });

  if (!order) return null;
  return {
    orderId: order.id,
    orderType: "ALBUM",
    total: order.totalCents,
    customerName: null,
    photographerName: null,
    customerEmail: order.buyerEmail,
    albumTitle: order.album?.title ?? null,
    albumSlug: order.album?.publicSlug ?? null,
    createdAt: order.createdAt.toISOString(),
  };
}
