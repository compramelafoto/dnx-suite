/**
 * Adaptador Prisma del puerto de ventas del Informe Diario.
 *
 * CUIDADO: `Order.totalCents` guarda PESOS ENTEROS, no centavos. El nombre
 * quedó por compatibilidad histórica y está documentado así en el esquema.
 * Nunca dividir por cien acá.
 */

import type { PrismaClient } from "@prisma/client";
import type { ClfSalesPort, DateRange, OrderOriginKey, PaidOrderRow } from "@repo/ops-daily-report";

export type OrderWithRelations = {
  id: number;
  totalCents: number;
  origin: string;
  album: {
    id: number;
    title: string;
    user: { id: number; name: string | null; email: string };
  };
  items: Array<{ quantity: number }>;
};

function normalizeOrigin(origin: string): OrderOriginKey {
  if (origin === "PACK_REDEMPTION") return "PACK_REDEMPTION";
  if (origin === "PREVENTA_PACK") return "PREVENTA_PACK";
  return "STANDARD_CHECKOUT";
}

export function toPaidOrderRow(order: OrderWithRelations): PaidOrderRow {
  return {
    orderId: order.id,
    totalArs: order.totalCents,
    photographerId: order.album.user.id,
    photographerName: order.album.user.name?.trim() || order.album.user.email,
    albumId: order.album.id,
    albumTitle: order.album.title,
    itemCount: order.items.reduce((total, item) => total + item.quantity, 0),
    origin: normalizeOrigin(order.origin),
  };
}

export function createPrismaSalesPort(client: PrismaClient): ClfSalesPort {
  return {
    async paidOrders(range: DateRange): Promise<PaidOrderRow[]> {
      const orders = await client.order.findMany({
        where: {
          status: "PAID",
          isTest: false,
          createdAt: { gte: range.start, lt: range.end },
        },
        select: {
          id: true,
          totalCents: true,
          origin: true,
          album: {
            select: {
              id: true,
              title: true,
              user: { select: { id: true, name: true, email: true } },
            },
          },
          items: { select: { quantity: true } },
        },
      });

      return orders.map((order) => toPaidOrderRow(order as OrderWithRelations));
    },

    async countPendingOrders(range: DateRange): Promise<number> {
      return client.order.count({
        where: {
          status: "PENDING",
          isTest: false,
          createdAt: { gte: range.start, lt: range.end },
        },
      });
    },

    async countNewUsers(range: DateRange): Promise<number> {
      return client.user.count({
        where: { createdAt: { gte: range.start, lt: range.end } },
      });
    },

    async countNewAlbums(range: DateRange): Promise<number> {
      return client.album.count({
        where: { createdAt: { gte: range.start, lt: range.end } },
      });
    },

    async countUploadedPhotos(range: DateRange): Promise<number> {
      return client.photo.count({
        where: { createdAt: { gte: range.start, lt: range.end } },
      });
    },
  };
}
