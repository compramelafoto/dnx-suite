import type { Prisma } from "@/lib/prisma";

export type AlbumOrderPrintMirrorItemInput = {
  fileKey: string;
  originalName?: string | null;
  size: string;
  acabado: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
};

export type CreateAlbumOrderPrintOrderMirrorInput = {
  albumOrderId: number;
  photographerId: number | null;
  customerName?: string | null;
  customerEmail: string;
  customerPhone?: string | null;
  printItems: AlbumOrderPrintMirrorItemInput[];
  pricingSnapshot?: Prisma.InputJsonValue;
  internalNotesSuffix?: string;
};

/**
 * Crea PrintOrder espejo para un pedido de álbum con ítems impresos.
 * Idempotente por tag `ALBUM_ORDER:{orderId}`.
 */
export async function createAlbumOrderPrintOrderMirror(
  tx: Prisma.TransactionClient,
  input: CreateAlbumOrderPrintOrderMirrorInput
): Promise<{ printOrderId: number } | null> {
  const printItems = input.printItems.filter(
    (it) =>
      it.fileKey &&
      it.size &&
      Number.isFinite(it.quantity) &&
      it.quantity > 0 &&
      Number.isFinite(it.subtotal)
  );
  if (printItems.length === 0) return null;

  const tag = `ALBUM_ORDER:${input.albumOrderId}`;
  const existing = await tx.printOrder.findFirst({
    where: { tags: { has: tag } },
    select: { id: true },
  });
  if (existing) return { printOrderId: existing.id };

  const totalPrint = printItems.reduce((sum, it) => sum + Number(it.subtotal || 0), 0);

  const created = await tx.printOrder.create({
    data: {
      photographerId: input.photographerId,
      labId: null,
      pickupBy: "PHOTOGRAPHER",
      customerName: input.customerName ?? null,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone ?? null,
      currency: "ARS",
      total: Math.round(totalPrint),
      status: "CREATED",
      paymentStatus: "PENDING",
      tags: [tag],
      internalNotes: `Generado desde pedido de álbum #${input.albumOrderId}${
        input.internalNotesSuffix ? ` — ${input.internalNotesSuffix}` : ""
      }`,
      pricingSnapshot: input.pricingSnapshot,
      items: {
        create: printItems,
      },
    },
    select: { id: true },
  });

  return { printOrderId: created.id };
}

export async function syncAlbumOrderPrintMirrorContact(
  tx: Prisma.TransactionClient,
  input: {
    albumOrderId: number;
    customerName?: string | null;
    customerEmail: string;
    customerPhone?: string | null;
  }
): Promise<void> {
  const tag = `ALBUM_ORDER:${input.albumOrderId}`;
  await tx.printOrder.updateMany({
    where: { tags: { has: tag } },
    data: {
      customerName: input.customerName ?? null,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone ?? null,
    },
  });
}
