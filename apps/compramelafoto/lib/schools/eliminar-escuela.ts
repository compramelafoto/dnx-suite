import { prisma } from "@/lib/prisma";
import { motivoParaNoEliminarEscuela } from "./eliminar-escuela-reglas";

export type ResultadoEliminarEscuela =
  | { ok: true }
  | { ok: false; motivo: string };

/**
 * Elimina la escuela sólo si no tiene álbumes, pedidos de preventa ni
 * comisiones. El conteo y el borrado van en la misma transacción.
 */
export async function eliminarEscuelaSiEstaVacia(schoolId: number): Promise<ResultadoEliminarEscuela> {
  return prisma.$transaction(async (tx) => {
    const [albumes, pedidos, comisiones] = await Promise.all([
      tx.album.count({ where: { schoolId } }),
      tx.preCompraOrder.count({
        where: {
          OR: [
            { student: { schoolId } },
            { schoolCourse: { schoolId } },
            { albumRosterEntry: { schoolId } },
          ],
        },
      }),
      tx.organizerCommission.count({ where: { schoolId } }),
    ]);

    const motivo = motivoParaNoEliminarEscuela({ albumes, pedidos, comisiones });
    if (motivo) return { ok: false as const, motivo };

    await tx.school.delete({ where: { id: schoolId } });
    return { ok: true as const };
  });
}
