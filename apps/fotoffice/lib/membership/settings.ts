import { Prisma, prisma } from "@repo/db";

/** Valores por defecto, alineados con lo acordado con la SFPR. */
export const DEFAULT_DUES_SETTINGS = {
  generationDay: 1,
  dueDay: 10,
  graceDays: 5,
  initialDuesCount: 3,
  countJoinMonthIfBeforeDueDay: true,
  reminderDay: 5,
  collaboratorFloorMultiple: 1,
} as const;

export type DuesSettings = {
  dueDay: number;
  initialDuesCount: number;
  countJoinMonthIfBeforeDueDay: boolean;
  collaboratorFloorMultiple: number;
};

/**
 * Configuración de cuotas de una institución.
 *
 * Si todavía no configuró nada devuelve los valores por defecto **sin crear la fila**:
 * leer una configuración no debe escribir en la base.
 */
export async function getDuesSettings(workspaceId: string): Promise<DuesSettings> {
  const row = await prisma.membershipDuesSettings.findUnique({
    where: { workspaceId },
    select: {
      dueDay: true,
      initialDuesCount: true,
      countJoinMonthIfBeforeDueDay: true,
      collaboratorFloorMultiple: true,
    },
  });

  if (!row) {
    return {
      dueDay: DEFAULT_DUES_SETTINGS.dueDay,
      initialDuesCount: DEFAULT_DUES_SETTINGS.initialDuesCount,
      countJoinMonthIfBeforeDueDay: DEFAULT_DUES_SETTINGS.countJoinMonthIfBeforeDueDay,
      collaboratorFloorMultiple: DEFAULT_DUES_SETTINGS.collaboratorFloorMultiple,
    };
  }

  return {
    dueDay: row.dueDay,
    initialDuesCount: row.initialDuesCount,
    countJoinMonthIfBeforeDueDay: row.countJoinMonthIfBeforeDueDay,
    collaboratorFloorMultiple: Number(row.collaboratorFloorMultiple),
  };
}

export type ActiveFeeValue = {
  id: string;
  amountArs: Prisma.Decimal;
} | null;

/**
 * Valor de cuota vigente para una categoría, a una fecha dada.
 *
 * Busca primero un valor propio de la categoría y, si no hay, el general de la institución.
 * Devuelve `null` si no hay ninguno vigente — el alta no puede aprobarse sin valor, porque
 * generaría cargos en cero.
 */
export async function getActiveFeeValue(
  workspaceId: string,
  categoryId: string | null,
  at: Date,
): Promise<ActiveFeeValue> {
  const vigente = {
    workspaceId,
    validFrom: { lte: at },
    OR: [{ validUntil: null }, { validUntil: { gt: at } }],
  };

  if (categoryId) {
    const propio = await prisma.membershipFeeValue.findFirst({
      where: { ...vigente, categoryId },
      select: { id: true, amountArs: true },
      orderBy: { validFrom: "desc" },
    });
    if (propio) return propio;
  }

  return prisma.membershipFeeValue.findFirst({
    where: { ...vigente, categoryId: null },
    select: { id: true, amountArs: true },
    orderBy: { validFrom: "desc" },
  });
}
