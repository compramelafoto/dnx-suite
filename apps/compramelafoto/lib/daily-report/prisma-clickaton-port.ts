/**
 * Adaptador Prisma del puerto de Clickatón.
 *
 * CUIDADO — la unidad es distinta a la de ComprameLaFoto:
 * en Clickatón los importes de la base SÍ están en centavos ("minor units",
 * como documenta el esquema en ClickatonTicketType.priceAmount). Acá se
 * convierten a pesos una sola vez, para que el colector y el correo trabajen
 * siempre en pesos. En ComprameLaFoto, en cambio, `totalCents` ya son pesos.
 */

import type { PrismaClient } from "@prisma/client";
import type {
  ClickatonActivity,
  ClickatonPort,
  ClickatonRegistrationRow,
  ClickatonStoreOrderRow,
  DateRange,
} from "@repo/ops-daily-report";

/** Centavos → pesos, redondeando al peso. */
export function minorUnitsToArs(amount: number): number {
  return Math.round(amount / 100);
}

export function createPrismaClickatonPort(client: PrismaClient): ClickatonPort {
  return {
    async registrations(range: DateRange): Promise<ClickatonRegistrationRow[]> {
      const rows = await client.clickatonRegistration.findMany({
        where: {
          isOpsTest: false,
          createdAt: { gte: range.start, lt: range.end },
        },
        select: {
          id: true,
          editionId: true,
          status: true,
          paymentStatus: true,
          totalAmount: true,
          edition: { select: { name: true } },
          ticketType: { select: { name: true } },
        },
      });

      return rows.map((row) => ({
        registrationId: row.id,
        editionId: row.editionId,
        editionName: row.edition?.name ?? "Edición sin nombre",
        ticketTypeName: row.ticketType?.name ?? "Sin tipo",
        status: row.status,
        paymentStatus: row.paymentStatus,
        totalArs: minorUnitsToArs(row.totalAmount),
      }));
    },

    async storeOrders(range: DateRange): Promise<ClickatonStoreOrderRow[]> {
      const rows = await client.clickatonStoreOrder.findMany({
        where: {
          paymentStatus: "APPROVED",
          createdAt: { gte: range.start, lt: range.end },
        },
        select: {
          id: true,
          editionId: true,
          totalAmount: true,
          items: {
            select: {
              productNameSnapshot: true,
              quantity: true,
              lineSubtotalAmount: true,
            },
          },
        },
      });

      // Los pedidos de tienda guardan editionId suelto, sin relación declarada,
      // así que los nombres se resuelven en una sola consulta aparte.
      const editionIds = [...new Set(rows.map((row) => row.editionId).filter(Boolean))] as string[];
      const editions =
        editionIds.length > 0
          ? await client.clickatonEdition.findMany({
              where: { id: { in: editionIds } },
              select: { id: true, name: true },
            })
          : [];
      const editionNames = new Map(editions.map((edition) => [edition.id, edition.name]));

      return rows.map((row) => ({
        orderId: row.id,
        editionId: row.editionId ?? null,
        editionName: row.editionId ? (editionNames.get(row.editionId) ?? null) : null,
        totalArs: minorUnitsToArs(row.totalAmount),
        items: row.items.map((item) => ({
          productName: item.productNameSnapshot,
          quantity: item.quantity,
          subtotalArs: minorUnitsToArs(item.lineSubtotalAmount),
        })),
      }));
    },

    async activity(range: DateRange): Promise<ClickatonActivity> {
      const createdInRange = { createdAt: { gte: range.start, lt: range.end } };

      const [submissions, checkIns] = await Promise.all([
        client.clickatonPhotoSubmission.groupBy({
          by: ["status"],
          where: createdInRange,
          _count: { _all: true },
        }),
        client.clickatonCheckIn.count({
          where: {
            reversedAt: null,
            checkedInAt: { gte: range.start, lt: range.end },
          },
        }),
      ]);

      const photoSubmissionsByStatus: Record<string, number> = {};
      let photoSubmissions = 0;
      for (const group of submissions) {
        const count = group._count._all;
        photoSubmissionsByStatus[group.status] = count;
        photoSubmissions += count;
      }

      return { photoSubmissions, photoSubmissionsByStatus, checkIns };
    },
  };
}
