import "server-only";
import type { prisma } from "@repo/db";

/**
 * El origen «Instagram» del catálogo de orígenes del workspace (spec 2026-11-18 §5.4): lo que marca
 * en Consultas las que entraron por un mensaje directo. Se busca sin distinguir mayúsculas; si
 * estaba archivado se reactiva (el alta rechaza un origen archivado) y, si no existe, se crea al
 * final del orden. Devuelve su id.
 */
export const NOMBRE_ORIGEN_INSTAGRAM = "Instagram";

type ConOrigenes = Pick<typeof prisma, "fotofficeOrigen">;

export async function origenInstagram(tx: ConOrigenes, workspaceId: string): Promise<string> {
  const buscar = () =>
    tx.fotofficeOrigen.findFirst({
      where: { workspaceId, name: { equals: NOMBRE_ORIGEN_INSTAGRAM, mode: "insensitive" } },
      orderBy: { createdAt: "asc" },
      select: { id: true, archivedAt: true },
    });
  const existente = await buscar();
  if (existente) {
    if (existente.archivedAt) await tx.fotofficeOrigen.updateMany({ where: { id: existente.id, workspaceId }, data: { archivedAt: null } });
    return existente.id;
  }
  try {
    const ultimo = await tx.fotofficeOrigen.aggregate({ where: { workspaceId }, _max: { order: true } });
    const o = await tx.fotofficeOrigen.create({
      data: { workspaceId, name: NOMBRE_ORIGEN_INSTAGRAM, order: (ultimo._max.order ?? 0) + 1 },
      select: { id: true },
    });
    return o.id;
  } catch (e) {
    // Dos consultas a la vez: la otra ya lo creó.
    if ((e as { code?: unknown } | null)?.code !== "P2002") throw e;
    const otro = await buscar();
    if (!otro) throw e;
    return otro.id;
  }
}
