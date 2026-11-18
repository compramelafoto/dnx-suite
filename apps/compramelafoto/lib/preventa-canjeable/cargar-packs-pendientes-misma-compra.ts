import { OrderOrigin, prisma } from "@/lib/prisma";
import {
  packDelComprobante,
  packsPendientesDeLaMismaCompra,
  VENTANA_MISMA_COMPRA_MS,
  type PackPendienteDeLaMismaCompra,
} from "./packs-pendientes-misma-compra";

/**
 * Packs de preventa que la familia todavía tiene que pagar de la misma compra que `orderId`
 * (pagos encadenados). Sólo servidor. Nunca rompe la confirmación del pago: ante un error
 * devuelve una lista vacía.
 */
export async function cargarPacksPendientesDeLaMismaCompra(
  orderId: number,
): Promise<PackPendienteDeLaMismaCompra[]> {
  try {
    const pagado = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        albumId: true,
        buyerEmail: true,
        status: true,
        totalCents: true,
        createdAt: true,
        origin: true,
        isTest: true,
        preventaPackSnapshotJson: true,
      },
    });
    if (!pagado || pagado.origin !== OrderOrigin.PREVENTA_PACK || pagado.isTest) return [];
    if (pagado.status !== "PAID" || pagado.albumId == null) return [];
    const email = (pagado.buyerEmail ?? "").trim();
    if (!email) return [];

    const desde = new Date(pagado.createdAt.getTime() - VENTANA_MISMA_COMPRA_MS);
    const pedidos = await prisma.order.findMany({
      where: {
        albumId: pagado.albumId,
        buyerEmail: { equals: email, mode: "insensitive" },
        origin: OrderOrigin.PREVENTA_PACK,
        isTest: false,
        // Pendientes cercanos a esta compra + todos los pagados (para no ofrecer un pack que ya tiene).
        OR: [{ status: "PAID" }, { status: "PENDING", createdAt: { gte: desde } }],
      },
      select: { id: true, status: true, totalCents: true, createdAt: true, preventaPackSnapshotJson: true },
      take: 200,
    });

    const conPack = (p: (typeof pedidos)[number] | typeof pagado) => ({
      id: p.id,
      status: String(p.status),
      totalCents: p.totalCents,
      createdAt: p.createdAt,
      ...packDelComprobante(p.preventaPackSnapshotJson),
    });
    return packsPendientesDeLaMismaCompra(conPack(pagado), pedidos.map(conPack));
  } catch (err) {
    console.error("[mp-confirm] no se pudieron leer los packs pendientes de la compra", {
      orderId,
      err: String(err),
    });
    return [];
  }
}
