import "server-only";
import { prisma } from "@repo/db";

/**
 * Presupuesto por horas (spec 2026-10-28): la categoría genérica "Evento" para las consultas cuyo
 * tipo no coincide con ninguna categoría. La busca (si estaba archivada, la reactiva) o la crea una vez.
 */
export const NOMBRE_CATEGORIA_EVENTO = "Evento";

export async function asegurarCategoriaEvento(workspaceId: string): Promise<string> {
  const buscar = () =>
    prisma.fotofficeConsultaCategoria.findFirst({ where: { workspaceId, name: NOMBRE_CATEGORIA_EVENTO }, select: { id: true, archivedAt: true } });
  const existente = await buscar();
  if (existente) {
    // Archivada, el alta la rechazaría: se vuelve a activar (el nombre es único por workspace).
    if (existente.archivedAt) await prisma.fotofficeConsultaCategoria.updateMany({ where: { id: existente.id, workspaceId }, data: { archivedAt: null } });
    return existente.id;
  }
  try {
    const orden = await prisma.fotofficeConsultaCategoria.count({ where: { workspaceId } });
    const c = await prisma.fotofficeConsultaCategoria.create({
      data: { workspaceId, name: NOMBRE_CATEGORIA_EVENTO, group: "EVENTO", order: orden + 1 },
      select: { id: true },
    });
    return c.id;
  } catch (e) {
    // Dos consultas a la vez: la otra ya la creó.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    const otra = await buscar();
    if (!otra) throw e;
    return otra.id;
  }
}
