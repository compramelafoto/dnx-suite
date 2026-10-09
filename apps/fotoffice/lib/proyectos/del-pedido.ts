import "server-only";
import { prisma } from "@repo/db";
import { puedeVerProyectos, type CtxProyectos } from "./acceso";

export type ProyectoDelPedido = { id: string; number: string; name: string; flujo: string; finalDueDate: string | null };

/** Los proyectos de un pedido, para su ficha. Sin "Ver" en Proyectos, nada. Sólo del workspace. */
export async function proyectosDeUnPedido(ctx: CtxProyectos, pedidoId: string): Promise<ProyectoDelPedido[]> {
  if (!puedeVerProyectos(ctx)) return [];
  const filas = await prisma.fotofficeProyecto.findMany({
    where: { workspaceId: ctx.workspaceId, pedidoId },
    orderBy: [{ createdAt: "asc" }, { number: "asc" }],
    select: { id: true, number: true, name: true, circuitId: true, finalDueDate: true },
    take: 200,
  });
  if (filas.length === 0) return [];
  const circuitos = await prisma.fotofficeCircuit.findMany({
    where: { workspaceId: ctx.workspaceId, id: { in: [...new Set(filas.map((f) => f.circuitId))] } },
    select: { id: true, name: true },
  });
  const nombre = new Map(circuitos.map((c) => [c.id, c.name]));
  return filas.map((f) => ({
    id: f.id,
    number: f.number,
    name: f.name,
    flujo: nombre.get(f.circuitId) ?? "Flujo",
    finalDueDate: f.finalDueDate ? f.finalDueDate.toISOString().slice(0, 10) : null,
  }));
}
