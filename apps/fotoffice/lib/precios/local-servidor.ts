import "server-only";
import { prisma } from "@repo/db";
import type { CuantoCobroStudioStructure, StudioLocalSales } from "@repo/cuanto-cobro-core";
import { mesesCompletos, sumarVentasPorMes } from "./local";

/**
 * Lo que vendió el local (líneas que no venden horas) en los últimos tres meses completos, según Caja.
 * `null` si ninguna de esas líneas tiene categorías de ingreso. Sólo informa: no entra en el precio.
 */
export async function ventasDelLocal(
  workspaceId: string,
  estructura: CuantoCobroStudioStructure,
  hoyAR: string,
): Promise<StudioLocalSales | null> {
  const categoryIds = [
    ...new Set(estructura.businessLines.filter((l) => !l.sellsHours).flatMap((l) => l.cashCategoryIds ?? [])),
  ];
  if (categoryIds.length === 0) return null;
  const meses = mesesCompletos(hoyAR);
  const desde = new Date(`${meses[meses.length - 1].desde}T00:00:00.000Z`);
  const hasta = new Date(`${meses[0].hasta}T00:00:00.000Z`);
  const filas = await prisma.cashMovement.findMany({
    where: {
      workspaceId,
      kind: "INGRESO",
      categoryId: { in: categoryIds },
      transferId: null,
      reversesMovementId: null,
      reversedBy: { is: null },
      occurredAt: { gte: desde, lt: hasta },
    },
    select: { occurredAt: true, amountArs: true },
  });
  return sumarVentasPorMes(
    filas.map((f) => ({ occurredAt: f.occurredAt, amountArs: Number(f.amountArs) })),
    meses,
  );
}
