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
  recommendationEnabled: false,
  recommendationBenefitPercent: 100,
} as const;

export type DuesSettings = {
  /** Día del mes en que se genera la cuota. */
  generationDay: number;
  dueDay: number;
  graceDays: number;
  reminderDay: number;
  initialDuesCount: number;
  countJoinMonthIfBeforeDueDay: boolean;
  collaboratorFloorMultiple: number;
  /** Si los socios pueden recomendar colegas y ganar cuotas bonificadas. */
  recommendationEnabled: boolean;
  /** Porcentaje de la cuota que se bonifica por cada recomendado. */
  recommendationBenefitPercent: number;
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
      generationDay: true,
      dueDay: true,
      graceDays: true,
      reminderDay: true,
      initialDuesCount: true,
      countJoinMonthIfBeforeDueDay: true,
      collaboratorFloorMultiple: true,
      recommendationEnabled: true,
      recommendationBenefitPercent: true,
    },
  });

  if (!row) {
    return {
      generationDay: DEFAULT_DUES_SETTINGS.generationDay,
      dueDay: DEFAULT_DUES_SETTINGS.dueDay,
      graceDays: DEFAULT_DUES_SETTINGS.graceDays,
      reminderDay: DEFAULT_DUES_SETTINGS.reminderDay,
      initialDuesCount: DEFAULT_DUES_SETTINGS.initialDuesCount,
      countJoinMonthIfBeforeDueDay: DEFAULT_DUES_SETTINGS.countJoinMonthIfBeforeDueDay,
      collaboratorFloorMultiple: DEFAULT_DUES_SETTINGS.collaboratorFloorMultiple,
      recommendationEnabled: DEFAULT_DUES_SETTINGS.recommendationEnabled,
      recommendationBenefitPercent: DEFAULT_DUES_SETTINGS.recommendationBenefitPercent,
    };
  }

  return {
    generationDay: row.generationDay,
    dueDay: row.dueDay,
    graceDays: row.graceDays,
    reminderDay: row.reminderDay,
    initialDuesCount: row.initialDuesCount,
    countJoinMonthIfBeforeDueDay: row.countJoinMonthIfBeforeDueDay,
    collaboratorFloorMultiple: Number(row.collaboratorFloorMultiple),
    recommendationEnabled: row.recommendationEnabled,
    recommendationBenefitPercent: Number(row.recommendationBenefitPercent),
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

/**
 * Valida el porcentaje que escribe la Secretaría.
 *
 * Tope duro en 100: bonificar más que la cuota dejaría saldo a favor, y el beneficio nunca
 * es dinero. Se acepta la coma como separador decimal porque es lo que se escribe acá.
 */
export function parseRecommendationPercent(
  raw: unknown,
): { ok: true; value: number } | { ok: false; error: string } {
  const texto = String(raw ?? "").trim().replace(",", ".");
  if (!texto) return { ok: false, error: "Escribí el porcentaje de la cuota que se bonifica." };
  const n = Number(texto);
  if (!Number.isFinite(n)) return { ok: false, error: "El porcentaje tiene que ser un número." };
  if (n < 0 || n > 100) return { ok: false, error: "El porcentaje va de 0 a 100." };
  return { ok: true, value: Math.round(n * 100) / 100 };
}
