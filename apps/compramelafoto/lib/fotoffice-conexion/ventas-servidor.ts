import "server-only";
import { prisma } from "@/lib/prisma";
import { parsePreventaPackSnapshotV1 } from "@/lib/preventa-canjeable/preventa-pack-snapshot-v1";
import { armarPagina, decodificarCursor, type EntradaVenta, type VentaFotoffice, ventaParaFotoffice } from "./ventas";

export const LIMITE_VENTAS = 200;

const EVENTOS = ["PAYMENT_APPROVED", "PAYMENT_REFUNDED", "PAYMENT_CHARGED_BACK"] as const;

function nombreDelPack(raw: unknown): string | null {
  if (raw == null) return null;
  try {
    return parsePreventaPackSnapshotV1(raw).packName || null;
  } catch {
    return null;
  }
}

const aNumero = (d: unknown): number | null => (d == null ? null : Number(d));

/**
 * Ventas del fotógrafo para FOTOFFICE: pedidos `Order` de álbumes cuyo dueño (`Album.userId`) es `userId`,
 * reales (`isTest=false`), cobrados por Mercado Pago, en PAID/REFUNDED/FAILED y con un `PAYMENT_APPROVED` en
 * `OrderAuditLog`. Orden (updatedAt, id), estrictamente después del cursor. Las copias `PrintOrder` son otro
 * modelo y no entran. Sale por la lista blanca de `ventaParaFotoffice`.
 */
export async function leerVentas(
  userId: number,
  cursorTexto: string | null,
  limite = LIMITE_VENTAS,
): Promise<{ ventas: VentaFotoffice[]; siguiente: string | null; hayMas: boolean } | { error: "CURSOR_INVALIDO" }> {
  const cursor = cursorTexto ? decodificarCursor(cursorTexto) : null;
  if (cursorTexto && !cursor) return { error: "CURSOR_INVALIDO" };

  const filas = await prisma.order.findMany({
    where: {
      album: { userId },
      isTest: false,
      checkoutPaymentSource: "MERCADO_PAGO",
      status: { in: ["PAID", "REFUNDED", "FAILED"] },
      ...(cursor
        ? { OR: [{ updatedAt: { gt: cursor.updatedAt } }, { updatedAt: cursor.updatedAt, id: { gt: cursor.id } }] }
        : {}),
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: limite + 1,
    select: {
      id: true,
      mpPaymentId: true,
      status: true,
      updatedAt: true,
      totalCents: true,
      platformCommissionCents: true,
      referralFeeDiscountCents: true,
      preventaPackSnapshotJson: true,
      album: { select: { id: true, title: true, user: { select: { mpUserId: true } } } },
      items: { select: { productType: true, size: true, quantity: true } },
      _count: { select: { videoItems: true } },
      eventOrganizerCommission: {
        select: {
          photographerNetAmount: true,
          organizerCommissionAmount: true,
          payoutMode: true,
          organizerUser: { select: { mpUserId: true } },
        },
      },
    },
  });

  const ids = filas.slice(0, limite).map((f) => f.id);
  const logs = ids.length
    ? await prisma.orderAuditLog.findMany({
        where: { targetOrderType: "ALBUM_ORDER", targetOrderId: { in: ids }, eventType: { in: [...EVENTOS] } },
        select: { targetOrderId: true, eventType: true, createdAt: true },
      })
    : [];
  const logsPorPedido = new Map<number, EntradaVenta["logs"]>();
  for (const l of logs) {
    const lista = logsPorPedido.get(l.targetOrderId) ?? [];
    lista.push({ eventType: l.eventType, createdAt: l.createdAt });
    logsPorPedido.set(l.targetOrderId, lista);
  }

  return armarPagina(filas, limite, cursorTexto, (f) => {
    const logsDelPedido = logsPorPedido.get(f.id) ?? [];
    if (!logsDelPedido.some((l) => l.eventType === "PAYMENT_APPROVED")) return null;
    const eoc = f.eventOrganizerCommission;
    return ventaParaFotoffice({
      order: {
        id: f.id,
        mpPaymentId: f.mpPaymentId,
        status: f.status as EntradaVenta["order"]["status"],
        updatedAt: f.updatedAt,
        totalCents: f.totalCents,
        platformCommissionCents: f.platformCommissionCents,
        referralFeeDiscountCents: f.referralFeeDiscountCents,
      },
      album: { id: f.album.id, title: f.album.title },
      logs: logsDelPedido,
      packName: nombreDelPack(f.preventaPackSnapshotJson),
      items: f.items.map((i) => ({ productType: String(i.productType), size: i.size, quantity: i.quantity })),
      videos: f._count.videoItems,
      organizador: eoc
        ? {
            photographerNetAmount: aNumero(eoc.photographerNetAmount),
            organizerCommissionAmount: aNumero(eoc.organizerCommissionAmount) ?? 0,
            payoutMode: String(eoc.payoutMode),
            organizadorMpUserId: eoc.organizerUser?.mpUserId ?? null,
          }
        : null,
      duenoMpUserId: f.album.user?.mpUserId ?? null,
    });
  });
}
