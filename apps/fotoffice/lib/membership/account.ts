import "server-only";
import { prisma } from "@repo/db";
import { decimalArsToMinor } from "./money";
import { sortOldestFirst, type OpenCharge } from "./select-charges";

/**
 * Estado de cuenta de un socio.
 *
 * Los importes salen de la base como `Decimal` y acá se pasan a centavos enteros (ver
 * `money.ts`). De este punto para adentro no hay coma flotante.
 */

export type MemberAccount = {
  charges: OpenCharge[];
  totalDueMinor: number;
  /** Cuotas vencidas al día de hoy. */
  overdueCount: number;
  oldestOverduePeriod: string | null;
};

export async function loadMemberAccount(
  memberId: string,
  opciones: { now?: Date } = {},
): Promise<MemberAccount> {
  const ahora = opciones.now ?? new Date();

  const filas = await prisma.membershipCharge.findMany({
    where: { memberId, balanceArs: { gt: 0 } },
    select: { id: true, concept: true, period: true, dueDate: true, balanceArs: true },
  });

  const charges: OpenCharge[] = sortOldestFirst(
    filas.map((f) => ({
      id: f.id,
      concept: String(f.concept),
      period: f.period,
      dueDate: f.dueDate,
      balanceMinor: decimalArsToMinor(f.balanceArs),
    })),
  );

  const vencidas = charges.filter((c) => c.dueDate.getTime() < ahora.getTime());

  return {
    charges,
    totalDueMinor: charges.reduce((s, c) => s + c.balanceMinor, 0),
    overdueCount: vencidas.length,
    oldestOverduePeriod: vencidas[0]?.period ?? null,
  };
}
