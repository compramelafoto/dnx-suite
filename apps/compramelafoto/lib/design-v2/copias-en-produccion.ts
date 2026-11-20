import "server-only";
import { prisma } from "@/lib/prisma";
import { parseExternalPreventaRefs } from "@/lib/canje-externo/external-preventa";
import type { DesignActor } from "./projects";
import { ordenDeImpresion, type LibritoEnProduccion } from "./produccion-reglas";

/**
 * Canjes escolares que son SÓLO copias impresas (sin librito): cómo entran en los lotes de
 * impresión y avanzan por «En imprenta», «Para entregar» y «Entregado».
 *
 * Los libritos guardan su avance en `DesignProject`; estos pedidos no tienen diseño, así que lo
 * guardan en `SchoolCopiesPrintJob` (una fila por pedido de canje, creada al mandarlo a imprimir).
 * El `id` de cada uno es el del pedido de canje (`Order.id`), el mismo que muestra «Ver pedido #…».
 */

export type PedidoDeCopias = LibritoEnProduccion & {
  orderId: number;
  printBatchName: string | null;
  sentToPrintAt: Date | null;
  printedAt: Date | null;
  deliveredAt: Date | null;
};

/**
 * Los pedidos de sólo copias del fotógrafo: por id de pedido de canje o por nombre de lote. Deja
 * afuera los ajenos, los que tienen librito (esos viajan con él) y los que son sólo digitales.
 */
export async function cargarPedidosDeCopias(
  actor: DesignActor,
  filtro: { copias?: number[]; lote?: string },
): Promise<PedidoDeCopias[]> {
  let ids = filtro.copias ?? [];
  if (filtro.lote) {
    const enLote = await prisma.schoolCopiesPrintJob.findMany({
      where: { printBatchName: filtro.lote, ...(actor.role === "ADMIN" ? {} : { photographerUserId: actor.id }) },
      select: { orderId: true },
    });
    ids = [...new Set([...ids, ...enLote.map((j) => j.orderId)])];
  }
  if (ids.length === 0) return [];

  const [packs, conLibrito, conCopias, avances] = await Promise.all([
    // El pack es el pedido de preventa; el canje es su `redemptionOrderId`.
    prisma.order.findMany({
      where: { redemptionOrderId: { in: ids } },
      select: {
        redemptionOrderId: true,
        redemptionPaymentRefsJson: true,
        album: { select: { userId: true, school: { select: { name: true } } } },
      },
    }),
    prisma.designProject.findMany({ where: { albumOrderId: { in: ids } }, select: { albumOrderId: true } }),
    prisma.orderItem.findMany({
      where: { orderId: { in: ids }, productType: { not: "DIGITAL" } },
      select: { orderId: true },
      distinct: ["orderId"],
    }),
    prisma.schoolCopiesPrintJob.findMany({ where: { orderId: { in: ids } } }),
  ]);
  const tienenLibrito = new Set(conLibrito.map((d) => d.albumOrderId));
  const tienenCopias = new Set(conCopias.map((c) => c.orderId));
  const avancePorPedido = new Map(avances.map((a) => [a.orderId, a]));

  const salida: PedidoDeCopias[] = [];
  for (const p of packs) {
    const orderId = p.redemptionOrderId;
    if (orderId == null) continue;
    if (actor.role !== "ADMIN" && p.album?.userId !== actor.id) continue;
    if (tienenLibrito.has(orderId) || !tienenCopias.has(orderId)) continue;
    const refs = parseExternalPreventaRefs(p.redemptionPaymentRefsJson);
    const a = avancePorPedido.get(orderId);
    salida.push({
      id: orderId,
      orderId,
      alumno: refs?.studentName?.trim() ?? "",
      curso: refs?.courseName?.trim() ?? "",
      colegio: (p.album?.school?.name ?? refs?.schoolName ?? "").trim(),
      printBatchName: a?.printBatchName ?? null,
      sentToPrintAt: a?.sentToPrintAt ?? null,
      printedAt: a?.printedAt ?? null,
      deliveredAt: a?.deliveredAt ?? null,
    });
  }
  return ordenDeImpresion(salida);
}

/** Los manda a imprimir dentro del lote `nombre` (crea su fila si todavía no la tenían). */
export async function mandarCopiasAImprimir(actor: DesignActor, pedidos: PedidoDeCopias[], nombre: string, ahora: Date) {
  for (const p of pedidos) {
    await prisma.schoolCopiesPrintJob.upsert({
      where: { orderId: p.orderId },
      create: { orderId: p.orderId, photographerUserId: actor.id, printBatchName: nombre, sentToPrintAt: ahora },
      update: { printBatchName: nombre, sentToPrintAt: ahora, printedAt: null, deliveredAt: null },
    });
  }
  return pedidos.length;
}

/** Cambia las fechas de los pedidos elegidos (sólo los que ya tienen fila: los mandados a imprimir). */
export async function actualizarCopias(
  orderIds: number[],
  data: { printBatchName?: null; sentToPrintAt?: null; printedAt?: Date | null; deliveredAt?: Date | null },
  donde: { printedAt?: null | { not: null }; deliveredAt?: null | { not: null }; sentToPrintAt?: { not: null } } = {},
): Promise<number> {
  if (orderIds.length === 0) return 0;
  const r = await prisma.schoolCopiesPrintJob.updateMany({ where: { orderId: { in: orderIds }, ...donde }, data });
  return r.count;
}

/** Filas de avance de copias del fotógrafo que están en algún lote (para el resumen de lotes). */
export async function avancesDeCopiasEnLotes(actor: DesignActor) {
  return prisma.schoolCopiesPrintJob.findMany({
    where: { ...(actor.role === "ADMIN" ? {} : { photographerUserId: actor.id }), printBatchName: { not: null } },
    select: { printBatchName: true, sentToPrintAt: true, printedAt: true, deliveredAt: true },
  });
}
