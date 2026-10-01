import type { PrismaClient } from "@/lib/prisma";
import { quoteVideoCart, type CartVideo, type VideoCartQuote } from "@/lib/videos/video-cart";

/**
 * Armado del pedido de videos.
 *
 * El pedido es un `Order` común: ahí viven el pago, el total y el fee, así que
 * el reparto con Mercado Pago y el panel del fotógrafo funcionan sin código
 * nuevo de dinero. Lo único propio son las líneas, en `VideoOrderItem`.
 */

export type VideoOrderInput = {
  albumId: number;
  videoIds: number[];
  buyerEmail: string;
  buyerName: string | null;
  buyerPhone: string | null;
  feePercent: number;
  isTest?: boolean;
};

export type VideoOrderCreation = {
  orderId: number;
  quote: VideoCartQuote;
};

/** Campos del video que necesita la cotización. */
const cartVideoSelect = {
  id: true,
  title: true,
  priceCents: true,
  sellEnabled: true,
  isRemoved: true,
  processingStatus: true,
  expiresAt: true,
} as const;

/**
 * Trae los videos pedidos, acotados al álbum.
 *
 * El filtro por álbum no es una formalidad: sin él, alguien podría pedir el id
 * de un video de otro álbum y comprarlo al precio de este.
 */
export async function loadCartVideos(
  prisma: PrismaClient,
  albumId: number,
  videoIds: number[]
): Promise<CartVideo[]> {
  if (videoIds.length === 0) return [];
  const rows = await prisma.videoAsset.findMany({
    where: { id: { in: videoIds }, albumId },
    select: cartVideoSelect,
  });
  return rows.map((r) => ({ ...r, processingStatus: String(r.processingStatus) }));
}

/**
 * Crea el pedido con sus videos, en una sola transacción.
 *
 * El total que se guarda es el del carrito cotizado, no uno que venga del
 * cliente: el precio lo pone siempre el servidor.
 */
export async function createVideoOrder(
  prisma: PrismaClient,
  input: VideoOrderInput,
  quote: VideoCartQuote
): Promise<VideoOrderCreation> {
  if (!quote.payable) {
    throw new Error("El carrito de videos no tiene nada cobrable");
  }

  const order = await prisma.$transaction(async (tx) => {
    const creado = await tx.order.create({
      data: {
        albumId: input.albumId,
        buyerEmail: input.buyerEmail,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        status: "PENDING",
        totalCents: quote.clientTotalArs,
        platformCommissionCents: quote.feeTotalArs,
        isTest: input.isTest ?? false,
        // Queda registrado con qué números se cobró, para poder auditar una
        // venta incluso después de que el video se borre a los 15 días.
        pricingSnapshot: {
          kind: "VIDEO_ORDER",
          feePercent: input.feePercent,
          photographerTotalArs: quote.photographerTotalArs,
          feeTotalArs: quote.feeTotalArs,
          clientTotalArs: quote.clientTotalArs,
          items: quote.items,
        },
      },
      select: { id: true },
    });

    await tx.videoOrderItem.createMany({
      data: quote.items.map((item) => ({
        orderId: creado.id,
        videoId: item.videoId,
        priceArs: item.priceArs,
        feeArs: item.feeArs,
        subtotalArs: item.subtotalArs,
        feePercent: item.feePercent,
        videoTitle: item.videoTitle,
      })),
    });

    return creado;
  });

  console.info("[video-order] creado", {
    orderId: order.id,
    albumId: input.albumId,
    videos: quote.items.length,
    clientTotalArs: quote.clientTotalArs,
    feeTotalArs: quote.feeTotalArs,
  });

  return { orderId: order.id, quote };
}

/** Cotiza y crea en un paso, con el precio siempre calculado en el servidor. */
export async function quoteAndCreateVideoOrder(
  prisma: PrismaClient,
  input: VideoOrderInput
): Promise<VideoOrderCreation & { quote: VideoCartQuote }> {
  const videos = await loadCartVideos(prisma, input.albumId, input.videoIds);
  const quote = quoteVideoCart(videos, input.feePercent);
  const created = await createVideoOrder(prisma, input, quote);
  return { ...created, quote };
}
