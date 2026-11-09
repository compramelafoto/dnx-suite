import { prisma } from "@/lib/prisma";
import { resolveClientMarketplaceFeePercent } from "@/lib/pricing/client-price";
import { baseFromTotal, feeFromTotal } from "@/lib/pricing/fee-formula";

/** Lo que el piloto necesita de un pedido de álbum. Montos en pesos enteros. */
export async function cargarPedidoPiloto(pedidoId: number) {
  const order = await prisma.order.findUnique({
    where: { id: pedidoId },
    select: {
      id: true,
      status: true,
      origin: true,
      albumId: true,
      buyerEmail: true,
      mpPaymentId: true,
      totalCents: true,
      extensionSurchargeCents: true,
      referralFeeDiscountCents: true,
      pricingSnapshot: true,
      createdAt: true,
      album: {
        select: {
          title: true,
          userId: true,
          eventId: true,
          schoolId: true,
          selectedLabId: true,
          createdAt: true,
        },
      },
      items: { select: { productType: true } },
    },
  });
  if (!order) return null;

  // Mismo cálculo que `finalizeAlbumOrderMercadoPagoApproved` para un pedido sólo digital:
  // el recargo de la plataforma se saca del total con el porcentaje del fotógrafo.
  const percent = await resolveClientMarketplaceFeePercent({
    photographerId: order.album?.userId ?? null,
    labId: order.album?.selectedLabId ?? null,
  });
  const extension = Number(order.extensionSurchargeCents ?? 0);
  const sinExtension = Math.max(0, order.totalCents - extension);
  const feePesos = feeFromTotal(sinExtension, percent) + extension;
  // Precio de la foto como lo toma la comisión del organizador (`ensureEventOrganizerCommission…`).
  const basePesos = baseFromTotal(sinExtension, percent);
  return { order, feePesos, basePesos };
}

export type PedidoPiloto = NonNullable<Awaited<ReturnType<typeof cargarPedidoPiloto>>>;
