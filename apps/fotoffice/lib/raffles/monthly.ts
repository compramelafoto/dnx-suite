import "server-only";
import { prisma } from "@repo/db";
import {
  activeCommitmentsFor,
  nextPeriod,
  periodOf,
  planMonthlyRaffle,
  type Commitment,
} from "./commitments";
import { recordRaffleEvent } from "./events";

/**
 * El sorteo de cada mes, creado solo.
 *
 * Mismo criterio que la generación mensual de cuotas: la tarea programada arma el borrador con
 * los premios que los aliados ya se comprometieron a dar, y la Secretaría sólo revisa y
 * anuncia. Sin esto, el ciclo mensual depende de que alguien se acuerde.
 *
 * Deja el sorteo en BORRADOR a propósito. Anunciar es lo que fija la tanda de drand y congela
 * los premios: ese paso lo aprieta una persona, no una tarea, porque a partir de ahí el sorteo
 * es público y ya no se toca.
 *
 * Es idempotente por la base: `@@unique([workspaceId, period])` impide dos sorteos del mismo
 * mes, y `@@unique([raffleId, commitmentId])` impide que un compromiso entre dos veces.
 */

export type MonthlyReport = {
  creados: number;
  /** Meses que tocaba crear pero quedaron sin ningún premio comprometido vigente. */
  sinPremios: number;
};

export async function generateMonthlyRaffles(now: Date = new Date()): Promise<MonthlyReport> {
  const instituciones = await prisma.raffleSettings.findMany({
    where: { monthlyEnabled: true },
    select: {
      workspaceId: true,
      drawDay: true,
      drawHour: true,
      entriesCloseHoursBefore: true,
      pickupDays: true,
      createDaysAhead: true,
    },
  });

  let creados = 0;
  let sinPremios = 0;

  for (const reglas of instituciones) {
    // Cuál es el próximo sorteo que toca. El del mes en curso mientras su fecha no haya
    // pasado; si ya pasó, el del mes que viene. Mirar siempre el mes siguiente crearía el
    // sorteo de octubre a principios de septiembre, con cinco semanas de anticipación.
    const enCurso = periodOf(now);
    const planEnCurso = planMonthlyRaffle(enCurso, reglas);
    const periodo =
      planEnCurso.drawsAt.getTime() > now.getTime() ? enCurso : nextPeriod(enCurso);
    const plan = periodo === enCurso ? planEnCurso : planMonthlyRaffle(periodo, reglas);

    // Todavía falta: el sorteo aparecería con demasiada anticipación y el socio estaría un mes
    // entero mirando algo que no le corre ningún plazo.
    const faltan = (plan.drawsAt.getTime() - now.getTime()) / 86_400_000;
    if (faltan > reglas.createDaysAhead) continue;

    const yaExiste = await prisma.raffle.findFirst({
      where: { workspaceId: reglas.workspaceId, period: periodo },
      select: { id: true },
    });
    if (yaExiste) continue;

    const compromisos = await prisma.rafflePrizeCommitment.findMany({
      where: { workspaceId: reglas.workspaceId, cancelledAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    });
    const vigentes = activeCommitmentsFor(compromisos as unknown as (Commitment & typeof compromisos[number])[], periodo);

    // Un sorteo sin premios no se puede anunciar. Crear el borrador vacío sólo agregaría una
    // fila que alguien tendría que borrar.
    if (vigentes.length === 0) {
      sinPremios += 1;
      continue;
    }

    // El orden entra en el cálculo del ganador y tiene que ser único dentro del sorteo: se
    // reasigna de forma consecutiva respetando el orden pedido por cada compromiso.
    const premios = vigentes.map((c, i) => ({
      order: i + 1,
      commitmentId: c.id,
      title: c.title,
      description: c.description,
      conditions: c.conditions,
      estimatedValueMinor: c.estimatedValueMinor,
      partnerId: c.partnerId,
      partnerNameSnapshot: c.partnerNameSnapshot,
      partnerEmailSnapshot: c.partnerEmailSnapshot,
      partnerAddressSnapshot: c.partnerAddressSnapshot,
      partnerPhoneSnapshot: c.partnerPhoneSnapshot,
      partnerHoursSnapshot: c.partnerHoursSnapshot,
    }));

    const sorteo = await prisma.raffle.create({
      data: {
        workspaceId: reglas.workspaceId,
        period: periodo,
        title: plan.title,
        entriesCloseAt: plan.entriesCloseAt,
        drawsAt: plan.drawsAt,
        pickupDays: reglas.pickupDays,
        status: "BORRADOR",
        prizes: { create: premios },
      },
      select: { id: true },
    });

    await recordRaffleEvent(prisma, {
      raffleId: sorteo.id,
      type: "CREADO",
      note: `Creado automáticamente para ${periodo}, con ${premios.length} ${premios.length === 1 ? "premio comprometido" : "premios comprometidos"}.`,
    });

    creados += 1;
  }

  return { creados, sinPremios };
}
