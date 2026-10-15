import "server-only";
import { prisma, Prisma } from "@repo/db";
import { decimalArsToMinor } from "@/lib/membership/money";

/**
 * Lecturas de los conteos de billetes (`CashCount`).
 *
 * La tabla es nueva y su migración se aplica a mano. Hasta que exista en la base, estas
 * lecturas devuelven vacío en vez de romper la pantalla: el contador sigue funcionando, sólo
 * que sin historial ni "último cambio usado".
 */

export function esTablaInexistente(e: unknown): boolean {
  return e instanceof Prisma.PrismaClientKnownRequestError && (e.code === "P2021" || e.code === "P2022");
}

export type ConteoRow = {
  id: string;
  createdAt: Date;
  createdByUserId: number | null;
  shiftId: string | null;
  countedMinor: number;
  expectedMinor: number | null;
  differenceMinor: number | null;
  floatMinor: number;
  toVaultMinor: number;
  transferId: string | null;
  adjustmentMovementId: string | null;
  note: string | null;
};

export async function ultimosConteos(workspaceId: string, accountId: string, take = 5): Promise<ConteoRow[]> {
  try {
    const rows = await prisma.cashCount.findMany({
      where: { workspaceId, accountId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        createdAt: true,
        createdByUserId: true,
        shiftId: true,
        countedAmountArs: true,
        expectedAmountArs: true,
        differenceArs: true,
        floatAmountArs: true,
        toVaultAmountArs: true,
        transferId: true,
        adjustmentMovementId: true,
        note: true,
      },
    });
    return rows.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      createdByUserId: r.createdByUserId,
      shiftId: r.shiftId,
      countedMinor: decimalArsToMinor(r.countedAmountArs),
      expectedMinor: r.expectedAmountArs === null ? null : decimalArsToMinor(r.expectedAmountArs),
      differenceMinor: r.differenceArs === null ? null : decimalArsToMinor(r.differenceArs),
      floatMinor: decimalArsToMinor(r.floatAmountArs),
      toVaultMinor: decimalArsToMinor(r.toVaultAmountArs),
      transferId: r.transferId,
      adjustmentMovementId: r.adjustmentMovementId,
      note: r.note,
    }));
  } catch (e) {
    if (esTablaInexistente(e)) return [];
    throw e;
  }
}
