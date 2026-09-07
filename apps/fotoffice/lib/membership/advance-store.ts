import "server-only";
import { prisma } from "@repo/db";
import {
  MAX_ADVANCE_MONTHS,
  advanceAmountMinorFor,
  advanceCandidatePeriods,
  planAdvancePeriods,
  type AdvancePeriod,
} from "./advance";
import { getActiveFeeValue, getDuesSettings } from "./settings";
import { minorToDecimalString } from "./money";
import { periodOf } from "./monthly-plan";
import type { FeeScale } from "./amounts";
import { monthlyDuePeriod } from "./periods";

/**
 * Adelantar cuotas.
 *
 * Los cargos adelantados se crean **al pedirlos** y se pagan por el circuito normal: no hay
 * un cobro aparte ni un estado nuevo. La cuota de diciembre pagada en octubre es la cuota de
 * diciembre, y cuando llegue diciembre la generación mensual la va a encontrar hecha y no la
 * va a duplicar — la clave `[memberId, concept, period]` ya es única.
 */

/** Desde qué mes se puede adelantar: el primero que el socio todavía no tiene cargado. */
async function primerMesLibre(memberId: string, ahora: Date): Promise<string> {
  const ultimo = await prisma.membershipCharge.findFirst({
    where: { memberId, concept: "MENSUAL" },
    orderBy: { period: "desc" },
    select: { period: true },
  });

  // Sin ningún cargo mensual todavía (el padrón recién migrado, por ejemplo), el mes corriente
  // no está cargado por nadie: el primer mes libre es HOY, no el que sigue. Si en cambio ya
  // tiene cargos, el corriente puede estar generado o no según cuándo corrió la generación
  // mensual del mes — por eso ahí se sigue ofreciendo desde el mes siguiente al último que
  // tiene, nunca uno que ya podría estar cargado.
  if (!ultimo) return periodOf(ahora);

  const [a, m] = ultimo.period.split("-").map(Number);
  const siguiente = new Date(Date.UTC(a ?? 1970, (m ?? 1), 1));
  return periodOf(siguiente);
}

export async function loadAdvanceOffer(
  memberId: string,
  opciones: { now?: Date } = {},
): Promise<{ periods: AdvancePeriod[] }> {
  const ahora = opciones.now ?? new Date();
  const socio = await prisma.member.findUnique({
    where: { id: memberId },
    select: {
      workspaceId: true,
      categoryId: true,
      feeScale: true,
      ownDuesAmount: true,
      category: { select: { generatesDues: true } },
    },
  });
  if (!socio) return { periods: [] };

  // Los honorarios (u otra categoría que no genera cuotas) no tienen nada para adelantar:
  // ofrecerles un precio sería inventar una deuda que la institución nunca definió para
  // ellos. Sin categoría se asume que sí genera cuotas, igual que en la generación mensual.
  if (!(socio.category?.generatesDues ?? true)) {
    return { periods: [] };
  }

  const [settings, desde] = await Promise.all([
    getDuesSettings(socio.workspaceId),
    primerMesLibre(memberId, ahora),
  ]);

  // Se ofrece el tope completo; cuántos toma de verdad lo elige el socio en la pantalla.
  const periodos = advanceCandidatePeriods(desde, MAX_ADVANCE_MONTHS);

  // El valor de referencia se pide al vencimiento de CADA período, no a hoy: si ya hay un
  // aumento resuelto para noviembre (un `MembershipFeeValue` con `validFrom` futuro que la
  // asamblea ya votó), adelantar noviembre tiene que cobrarlo a ese valor, no al de hoy —
  // mismo criterio que usa la generación mensual, y por la misma razón: el cargo se crea con
  // `upsert`, así que si se lo carga mal acá, la generación mensual lo va a encontrar hecho
  // y nunca lo va a corregir.
  const feeValuesMinor = await Promise.all(
    periodos.map(async (period) => {
      const vencimiento = monthlyDuePeriod(period, settings.dueDay).dueDate;
      const valor = await getActiveFeeValue(socio.workspaceId, socio.categoryId, vencimiento);
      return advanceAmountMinorFor({
        referenceAmount: valor?.amountArs ?? null,
        scale: socio.feeScale as FeeScale,
        ownAmount: socio.ownDuesAmount,
        floorMultiple: settings.collaboratorFloorMultiple,
      });
    }),
  );

  return {
    periods: planAdvancePeriods({
      fromPeriod: desde,
      months: MAX_ADVANCE_MONTHS,
      feeValuesMinor,
      dueDay: settings.dueDay,
    }),
  };
}

export async function createAdvanceCharges(input: {
  memberId: string;
  months: number;
}): Promise<{ ok: true; chargeIds: string[]; totalMinor: number } | { ok: false; error: string }> {
  const socio = await prisma.member.findUnique({
    where: { id: input.memberId },
    select: { workspaceId: true, categoryId: true },
  });
  if (!socio) return { ok: false, error: "No encontramos tu ficha de socio." };

  const oferta = await loadAdvanceOffer(input.memberId);
  if (oferta.periods.length === 0) {
    return { ok: false, error: "La institución todavía no fijó el valor de la cuota." };
  }
  const elegidos = oferta.periods.slice(0, Math.max(0, input.months));
  if (elegidos.length === 0) {
    return { ok: false, error: "Elegí cuántos meses querés adelantar." };
  }

  const chargeIds: string[] = [];
  for (const p of elegidos) {
    const creado = await prisma.membershipCharge.upsert({
      where: {
        memberId_concept_period: { memberId: input.memberId, concept: "MENSUAL", period: p.period },
      },
      create: {
        workspaceId: socio.workspaceId,
        memberId: input.memberId,
        concept: "MENSUAL",
        period: p.period,
        amountArs: minorToDecimalString(p.amountMinor),
        balanceArs: minorToDecimalString(p.amountMinor),
        dueDate: p.dueDate,
      },
      // Ya existía: no se le toca el importe ni el saldo. Adelantar no puede reescribir una
      // cuota que la institución ya generó ni resucitar una ya pagada.
      update: {},
      select: { id: true },
    });
    chargeIds.push(creado.id);
  }

  return {
    ok: true,
    chargeIds,
    totalMinor: elegidos.reduce((s, p) => s + p.amountMinor, 0),
  };
}
