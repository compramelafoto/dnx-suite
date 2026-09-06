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

import { monthlyDuePeriod } from "./periods";

export const MAX_ADVANCE_MONTHS = 6;

export type AdvancePeriod = {
  /** `AAAA-MM`. */
  period: string;
  amountMinor: number;
  dueDate: Date;
};

const PERIOD_RE = /^\d{4}-\d{2}$/;

export function planAdvancePeriods(input: {
  /** Primer mes a adelantar, `AAAA-MM`. */
  fromPeriod: string;
  months: number;
  /** Valor de la cuota vigente, en centavos. Cero significa que no hay valor fijado. */
  feeValueMinor: number;
  dueDay: number;
}): AdvancePeriod[] {
  if (!PERIOD_RE.test(input.fromPeriod)) return [];
  if (!Number.isInteger(input.months) || input.months < 1) return [];
  // `feeValueMinor` debe ser entero y positivo. En JavaScript, `NaN <= 0` es `false`,
  // así que una validación por magnitud no alcanza cuando lo que se decide es plata.
  if (!Number.isInteger(input.feeValueMinor) || input.feeValueMinor <= 0) return [];
  // `dueDay` debe ser entero entre 1 y 31. Un valor fuera de rango (0, negativo, NaN)
  // puede desbordar el cálculo del vencimiento al mes anterior o producir dates inválidas.
  if (!Number.isInteger(input.dueDay) || input.dueDay < 1 || input.dueDay > 31) return [];

  const [anio, mes] = input.fromPeriod.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return [];

  const cuantos = Math.min(input.months, MAX_ADVANCE_MONTHS);
  const salida: AdvancePeriod[] = [];

  let y = anio;
  let m = mes;
  for (let i = 0; i < cuantos; i += 1) {
    const period = `${y}-${String(m).padStart(2, "0")}`;
    const duePeriod = monthlyDuePeriod(period, input.dueDay);
    salida.push({
      period: duePeriod.period,
      amountMinor: input.feeValueMinor,
      dueDate: duePeriod.dueDate,
    });
    // Pasar al siguiente mes.
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }

  return salida;
}
