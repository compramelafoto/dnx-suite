import "server-only";
import { prisma } from "@/lib/prisma";
import { countSales, selectEntrants, type CandidateUser } from "./elegibilidad";
import type { EntrantInput } from "./padron";

/**
 * Las lecturas de la base que alimentan el padrón.
 *
 * Una venta es un pedido PAGADO dentro del período:
 * - pedidos de álbum (`Order`): sin los de prueba, sin álbumes de prueba y con importe;
 * - pedidos de impresión (`PrintOrder`) del fotógrafo, sin los espejos de un pedido de álbum
 *   (llevan la etiqueta `ALBUM_ORDER:`), que son la misma venta contada dos veces.
 *
 * Se mide por la fecha del pedido (`createdAt`), igual que el ranking de ventas del admin.
 */
export async function loadSalesInWindow(from: Date, to: Date): Promise<Map<number, number>> {
  const [albumOrders, printOrders] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: "PAID",
        isTest: false,
        totalCents: { gt: 0 },
        createdAt: { gte: from, lt: to },
        album: { isTest: false },
      },
      select: { album: { select: { userId: true } } },
    }),
    prisma.printOrder.findMany({
      where: {
        paymentStatus: "PAID",
        photographerId: { not: null },
        total: { gt: 0 },
        createdAt: { gte: from, lt: to },
      },
      select: { photographerId: true, tags: true },
    }),
  ]);

  const filas: { userId: number | null }[] = albumOrders.map((o) => ({ userId: o.album?.userId ?? null }));
  for (const p of printOrders) {
    const espejo = (p.tags ?? []).some((t) => String(t).startsWith("ALBUM_ORDER:"));
    if (!espejo) filas.push({ userId: p.photographerId });
  }
  return countSales(filas);
}

/** Las ventas de UN fotógrafo en el período (mismo criterio), para su panel. */
export async function loadSalesForUser(userId: number, from: Date, to: Date): Promise<number> {
  const [album, prints] = await Promise.all([
    prisma.order.count({
      where: {
        status: "PAID",
        isTest: false,
        totalCents: { gt: 0 },
        createdAt: { gte: from, lt: to },
        album: { isTest: false, userId },
      },
    }),
    prisma.printOrder.findMany({
      where: {
        paymentStatus: "PAID",
        photographerId: userId,
        total: { gt: 0 },
        createdAt: { gte: from, lt: to },
      },
      select: { tags: true },
    }),
  ]);
  return album + prints.filter((p) => !(p.tags ?? []).some((t) => String(t).startsWith("ALBUM_ORDER:"))).length;
}

export async function loadCandidateUsers(ids: readonly number[]): Promise<CandidateUser[]> {
  if (ids.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...ids] } },
    select: { id: true, name: true, companyName: true, role: true, isBlocked: true, tags: true },
  });
  return users.map((u) => ({ ...u, role: String(u.role) }));
}

/** El padrón tal como quedaría si se cerrara ahora (sin ordenar). */
export async function computeEntrants(input: {
  salesFrom: Date;
  salesTo: Date;
  minSales: number;
  excludedUserIds: readonly number[];
}): Promise<EntrantInput[]> {
  const ventas = await loadSalesInWindow(input.salesFrom, input.salesTo);
  const users = await loadCandidateUsers([...ventas.keys()]);
  return selectEntrants({
    sales: ventas,
    users,
    minSales: input.minSales,
    excludedUserIds: input.excludedUserIds,
  });
}

export async function loadSettings() {
  return prisma.clfRaffleSettings.upsert({
    where: { id: "default" },
    create: { id: "default" },
    update: {},
  });
}
