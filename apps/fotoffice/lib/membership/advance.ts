/**
 * Qué meses puede adelantar un socio, y a qué precio.
 *
 * El socio elige **cuántos meses**, no un importe. Cobrar un importe libre es lo que dejaba
 * sobrantes flotando; adelantar cuotas es una operación con precio conocido de las dos partes.
 *
 * ── Por qué hay un tope ──
 *
 * Adelantar congela el precio: quien paga doce meses antes de un aumento los paga al valor
 * viejo. Seis es el límite hasta que la institución decida otra cosa, y vive en el código y
 * no en la configuración a propósito — es una decisión de riesgo económico, no una preferencia
 * de cada institución.
 *
 * Módulo PURO.
 */

import type { Prisma } from "@repo/db";
import { monthlyDuePeriod } from "./periods";
import { monthlyAmountFor, type FeeScale } from "./amounts";
import { decimalArsToMinor } from "./money";

export const MAX_ADVANCE_MONTHS = 6;

export type AdvancePeriod = {
  /** `AAAA-MM`. */
  period: string;
  amountMinor: number;
  dueDate: Date;
};

const PERIOD_RE = /^\d{4}-\d{2}$/;

/**
 * Los meses candidatos a partir de `fromPeriod`, en orden y topeados en `MAX_ADVANCE_MONTHS`.
 *
 * Separado de `planAdvancePeriods` porque quien arma la oferta necesita saber primero QUÉ
 * períodos va a ofrecer, para poder ir a buscar el valor de cuota vigente de cada uno (que
 * puede variar de un mes a otro si ya hay un aumento resuelto) antes de fijar el precio.
 */
export function advanceCandidatePeriods(fromPeriod: string, months: number): string[] {
  if (!PERIOD_RE.test(fromPeriod)) return [];
  if (!Number.isInteger(months) || months < 1) return [];

  const [anio, mes] = fromPeriod.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return [];

  const cuantos = Math.min(months, MAX_ADVANCE_MONTHS);
  const salida: string[] = [];

  let y = anio;
  let m = mes;
  for (let i = 0; i < cuantos; i += 1) {
    salida.push(`${y}-${String(m).padStart(2, "0")}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return salida;
}

/**
 * Cuánto le corresponde pagar a ESTE socio, en un período, dado el valor de referencia
 * vigente para su categoría al vencimiento de ese período.
 *
 * Reutiliza el mismo cálculo por socio que la cuota mensual (`monthlyAmountFor`): escala,
 * monto propio y piso de colaborador. Sin esto, un socio de escala REDUCIDA que adelanta
 * pagaría el doble del que le corresponde, y uno EXENTA sin monto propio podría cobrarse un
 * mes que no le toca.
 *
 * Devuelve `null` cuando no hay nada para ofrecer ese mes: sin valor de referencia vigente
 * (`referenceAmount` es `null`), o con una cuota que da cero (exento sin monto propio).
 */
export function advanceAmountMinorFor(input: {
  referenceAmount: Prisma.Decimal | null;
  scale: FeeScale;
  ownAmount: Prisma.Decimal | null;
  floorMultiple: number;
}): number | null {
  if (!input.referenceAmount) return null;
  const amountArs = monthlyAmountFor({
    referenceAmount: input.referenceAmount,
    scale: input.scale,
    ownAmount: input.ownAmount,
    floorMultiple: input.floorMultiple,
  });
  if (amountArs.lte(0)) return null;
  return decimalArsToMinor(amountArs);
}

export function planAdvancePeriods(input: {
  /** Primer mes a adelantar, `AAAA-MM`. */
  fromPeriod: string;
  months: number;
  /**
   * Importe en centavos para cada mes candidato, ya calculado para este socio en particular
   * (con su escala y su monto propio aplicados) y resuelto al vencimiento de ESE período —
   * no al valor de hoy. Mismo orden que `advanceCandidatePeriods(fromPeriod, months)`.
   *
   * `null` (o cualquier valor que no sea entero positivo) en una posición significa que ese
   * período todavía no tiene un valor de cuota vigente: se lo salta sin cortar los que
   * siguen, porque cobrar ahí sería inventar un precio que la institución no fijó.
   */
  feeValuesMinor: (number | null)[];
  dueDay: number;
}): AdvancePeriod[] {
  // `dueDay` debe ser entero entre 1 y 31. Un valor fuera de rango (0, negativo, NaN)
  // puede desbordar el cálculo del vencimiento al mes anterior o producir dates inválidas.
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) return [];

  const periodos = advanceCandidatePeriods(input.fromPeriod, input.months);
  const salida: AdvancePeriod[] = [];

  for (let i = 0; i < periodos.length; i += 1) {
    const valor = input.feeValuesMinor[i];
    // Debe ser entero y positivo. En JavaScript, `NaN <= 0` es `false`, así que una
    // validación por magnitud no alcanza cuando lo que se decide es plata.
    if (!Number.isInteger(valor) || (valor as number) <= 0) continue;
    const duePeriod = monthlyDuePeriod(periodos[i] as string, input.dueDay);
    salida.push({
      period: duePeriod.period,
      amountMinor: valor as number,
      dueDate: duePeriod.dueDate,
    });
  }

  return salida;
}
