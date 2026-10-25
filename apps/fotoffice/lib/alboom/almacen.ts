import "server-only";
import { prisma, type Prisma } from "@repo/db";
import type { Almacen, FilaCruda } from "./extractor";

/**
 * `FotofficeAlboomCrudo` en la base. Toda consulta lleva `workspaceId`: los datos crudos de una institución no
 * se leen ni se pisan desde otra. El payload sólo sale de acá hacia el extractor (y en la 8B, hacia la
 * traducción): ninguna pantalla lo pide; la pantalla usa `contarCrudosPorEntidad`.
 */
export const almacenPrisma: Almacen = {
  async guardarFilas(workspaceId, entity, filas: FilaCruda[]) {
    if (filas.length === 0) return { nuevos: 0, cambiados: 0, iguales: 0, tocados: [] };
    const existentes = await prisma.fotofficeAlboomCrudo.findMany({
      where: { workspaceId, entity, alboomId: { in: filas.map((f) => f.alboomId) } },
      select: { alboomId: true, hash: true },
    });
    const hashDe = new Map(existentes.map((x) => [x.alboomId, x.hash]));
    const nuevas = filas.filter((f) => !hashDe.has(f.alboomId));
    const cambiadas = filas.filter((f) => hashDe.has(f.alboomId) && hashDe.get(f.alboomId) !== f.hash);
    const iguales = filas.filter((f) => hashDe.get(f.alboomId) === f.hash);
    const ahora = new Date();

    if (nuevas.length > 0) {
      await prisma.fotofficeAlboomCrudo.createMany({
        data: nuevas.map((f) => ({
          workspaceId,
          entity,
          alboomId: f.alboomId,
          payload: f.payload as Prisma.InputJsonValue,
          hash: f.hash,
          fetchedAt: ahora,
          firstSeenAt: ahora,
        })),
        // Si dos tandas se cruzaran, la segunda no duplica (único workspaceId+entity+alboomId).
        skipDuplicates: true,
      });
    }
    for (const f of cambiadas) {
      await prisma.fotofficeAlboomCrudo.updateMany({
        where: { workspaceId, entity, alboomId: f.alboomId },
        data: { payload: f.payload as Prisma.InputJsonValue, hash: f.hash, fetchedAt: ahora },
      });
    }
    if (iguales.length > 0) {
      await prisma.fotofficeAlboomCrudo.updateMany({
        where: { workspaceId, entity, alboomId: { in: iguales.map((f) => f.alboomId) } },
        data: { fetchedAt: ahora },
      });
    }
    return {
      nuevos: nuevas.length,
      cambiados: cambiadas.length,
      iguales: iguales.length,
      tocados: [...nuevas, ...cambiadas].map((f) => f.alboomId),
    };
  },

  async leerLote(workspaceId, entity, despuesDe, limite) {
    const filas = await prisma.fotofficeAlboomCrudo.findMany({
      where: { workspaceId, entity, ...(despuesDe !== null ? { alboomId: { gt: despuesDe } } : {}) },
      orderBy: { alboomId: "asc" },
      take: limite,
      select: { alboomId: true, payload: true },
    });
    return filas.map((f) => ({ alboomId: f.alboomId, payload: f.payload as unknown }));
  },
};

/** Para la pantalla: cuántos registros crudos hay por entidad. Nunca el contenido. */
export async function contarCrudosPorEntidad(workspaceId: string): Promise<Record<string, number>> {
  const grupos = await prisma.fotofficeAlboomCrudo.groupBy({
    by: ["entity"],
    where: { workspaceId },
    _count: { _all: true },
  });
  return Object.fromEntries(grupos.map((g) => [g.entity, g._count._all]));
}
