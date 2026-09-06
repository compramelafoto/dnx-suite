import "server-only";
import { prisma } from "@repo/db";
import { MAX_ADVANCE_MONTHS, planAdvancePeriods, type AdvancePeriod } from "./advance";
import { getActiveFeeValue, getDuesSettings } from "./settings";
import { decimalArsToMinor, minorToDecimalString } from "./money";
import { periodOf } from "./monthly-plan";

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
): Promise<{ periods: AdvancePeriod[]; feeValueMinor: number }> {
  const ahora = opciones.now ?? new Date();
  const socio = await prisma.member.findUnique({
    where: { id: memberId },
    select: { workspaceId: true, categoryId: true },
  });
  if (!socio) return { periods: [], feeValueMinor: 0 };

  const [settings, valor, desde] = await Promise.all([
    getDuesSettings(socio.workspaceId),
    getActiveFeeValue(socio.workspaceId, socio.categoryId, ahora),
    primerMesLibre(memberId, ahora),
  ]);

  const feeValueMinor = valor ? decimalArsToMinor(valor.amountArs) : 0;
  return {
    periods: planAdvancePeriods({
      fromPeriod: desde,
      // Se ofrece el tope completo; cuántos toma de verdad lo elige el socio en la pantalla.
      months: MAX_ADVANCE_MONTHS,
      feeValueMinor,
      dueDay: settings.dueDay,
    }),
    feeValueMinor,
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
  if (oferta.feeValueMinor <= 0) {
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
