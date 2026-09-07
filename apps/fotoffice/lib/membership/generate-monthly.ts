import "server-only";
import { Prisma, prisma } from "@repo/db";
import { getActiveFeeValue, getDuesSettings } from "./settings";
import { planMonthlyCharges, type MemberForDues } from "./monthly-plan";
import { applyCreditForWorkspace } from "./apply-credit-store";

/**
 * Genera las cuotas mensuales de un período.
 *
 * **Idempotente.** La restricción única `[memberId, concept, period]` es el árbitro: correrla
 * dos veces no duplica cuotas. Eso importa porque la va a disparar tanto una tarea programada
 * como una persona apretando un botón, y las dos pueden coincidir.
 */

export type GenerateReport = {
  period: string;
  creadas: number;
  yaExistian: number;
  salteados: number;
  /** Por qué se salteó cada grupo, para poder explicarlo sin mirar la base. */
  motivos: Record<string, number>;
};

export async function generateMonthlyCharges(input: {
  workspaceId: string;
  /** `AAAA-MM`. */
  period: string;
}): Promise<GenerateReport> {
  const settings = await getDuesSettings(input.workspaceId);

  const socios = await prisma.member.findMany({
    where: { workspaceId: input.workspaceId, status: { not: "INACTIVE" } },
    select: {
      id: true,
      status: true,
      joinedAt: true,
      feeScale: true,
      ownDuesAmount: true,
      categoryId: true,
      category: { select: { generatesDues: true } },
    },
  });

  // El valor de referencia se resuelve al día del vencimiento del período, no a hoy: generar
  // agosto en septiembre tiene que usar el valor que regía en agosto.
  const [anio = "1970", mes = "01"] = input.period.split("-");
  const alVencimiento = new Date(
    Date.UTC(Number(anio), Number(mes) - 1, Math.min(settings.dueDay, 28)),
  );

  // Se pide el valor una vez por categoría, no una por socio: con 152 socios y 4 categorías,
  // la diferencia es 4 consultas contra 152.
  const categorias = new Set(socios.map((s) => s.categoryId));
  const valorPorCategoria = new Map<string | null, Prisma.Decimal | null>();
  for (const categoryId of categorias) {
    const valor = await getActiveFeeValue(input.workspaceId, categoryId, alVencimiento);
    valorPorCategoria.set(categoryId, valor?.amountArs ?? null);
  }

  const padron: MemberForDues[] = socios.map((s) => ({
    id: s.id,
    status: s.status as "ACTIVE" | "SUSPENDED" | "INACTIVE",
    joinedAt: s.joinedAt,
    feeScale: s.feeScale as MemberForDues["feeScale"],
    ownDuesAmount: s.ownDuesAmount,
    categoryId: s.categoryId,
    // Sin categoría se asume que genera cuotas: lo contrario dejaría sin cobrar a quien
    // todavía no fue clasificado, en silencio.
    categoryGeneratesDues: s.category?.generatesDues ?? true,
    referenceAmount: valorPorCategoria.get(s.categoryId) ?? null,
  }));

  const plan = planMonthlyCharges({
    period: input.period,
    members: padron,
    dueDay: settings.dueDay,
    floorMultiple: settings.collaboratorFloorMultiple,
    countJoinMonthIfBeforeDueDay: settings.countJoinMonthIfBeforeDueDay,
  });

  const motivos: Record<string, number> = {};
  for (const s of plan.skipped) {
    motivos[s.reason] = (motivos[s.reason] ?? 0) + 1;
  }

  let creadas = 0;
  let yaExistian = 0;

  // De a uno y no en una transacción gigante: si falla el socio 100, los 99 anteriores ya
  // tienen su cuota y volver a correrla no los duplica.
  for (const cargo of plan.charges) {
    try {
      await prisma.membershipCharge.create({
        data: {
          workspaceId: input.workspaceId,
          memberId: cargo.memberId,
          concept: "MENSUAL",
          period: cargo.period,
          amountArs: cargo.amountArs,
          balanceArs: cargo.amountArs,
          dueDate: cargo.dueDate,
        },
      });
      creadas += 1;
    } catch (error) {
      // P2002: ya existía la cuota de ese socio para ese período. Es el caso normal al
      // volver a correrla, no un error.
      if ((error as { code?: string })?.code === "P2002") {
        yaExistian += 1;
        continue;
      }
      throw error;
    }
  }

  // El socio que tenía saldo a favor no puede recibir un reclamo por una cuota que su
  // crédito ya cubre. Se corre después de crear los cargos, sobre los cargos recién creados.
  await applyCreditForWorkspace(input.workspaceId);

  return {
    period: input.period,
    creadas,
    yaExistian,
    salteados: plan.skipped.length,
    motivos,
  };
}
