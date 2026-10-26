import "server-only";
import { prisma } from "@repo/db";
import { CUENTA_VACIA, contarPedido, cuentasDeTrabajos, type CuentaPedido, type CuentaTrabajo } from "../cassettes";

/**
 * Cassettes vendidos y hechos de los trabajos de digitalización, leídos de la base (el criterio
 * vive en `../cassettes.ts`). Todo filtra por `workspaceId`.
 */

/** Lo que hace falta de un trabajo para contar sus cassettes (también para elegir los de digitalización). */
export function selectCuentaTrabajo(workspaceId: string) {
  return {
    id: true,
    name: true,
    pedidoId: true,
    pedidoItemIndex: true,
    product: { select: { name: true, category: { select: { name: true } } } },
    pedido: { select: { items: true } },
    grabaciones: { where: { workspaceId }, select: { estado: true, conversionEstado: true, sinImagen: true } },
  } as const;
}

/** La cuenta de cada trabajo de digitalización de esos pedidos, por pedido. */
export async function cuentasPorPedido(workspaceId: string, pedidoIds: readonly string[]): Promise<Map<string, { proyectoId: string; cuenta: CuentaTrabajo }[]>> {
  const r = new Map<string, { proyectoId: string; cuenta: CuentaTrabajo }[]>();
  if (pedidoIds.length === 0) return r;
  const trabajos = await prisma.fotofficeProyecto.findMany({
    where: { workspaceId, pedidoId: { in: [...new Set(pedidoIds)] } },
    select: selectCuentaTrabajo(workspaceId),
  });
  for (const { trabajo, cuenta } of cuentasDeTrabajos(trabajos ?? [])) {
    if (!trabajo.pedidoId) continue;
    r.set(trabajo.pedidoId, [...(r.get(trabajo.pedidoId) ?? []), { proyectoId: trabajo.id, cuenta }]);
  }
  return r;
}

/** Cassettes vendidos y hechos de cada pedido (sin trabajos de digitalización: cantidad desconocida). */
export async function cassettesDePedidos(workspaceId: string, pedidoIds: readonly string[]): Promise<Map<string, CuentaPedido>> {
  const porPedido = await cuentasPorPedido(workspaceId, pedidoIds);
  return new Map(pedidoIds.map((id) => [id, porPedido.has(id) ? contarPedido(porPedido.get(id)!.map((t) => t.cuenta)) : CUENTA_VACIA]));
}
