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
  if (input.feeValueMinor <= 0) return [];

  const [anio, mes] = input.fromPeriod.split("-").map(Number);
  if (!anio || !mes || mes < 1 || mes > 12) return [];

  const cuantos = Math.min(input.months, MAX_ADVANCE_MONTHS);
  const salida: AdvancePeriod[] = [];

  for (let i = 0; i < cuantos; i += 1) {
    const fecha = new Date(Date.UTC(anio, mes - 1 + i, 1));
    const a = fecha.getUTCFullYear();
    const m = fecha.getUTCMonth() + 1;
    // Último día real del mes: un vencimiento el 31 de febrero se desbordaría a marzo.
    const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
    salida.push({
      period: `${a}-${String(m).padStart(2, "0")}`,
      amountMinor: input.feeValueMinor,
      dueDate: new Date(Date.UTC(a, m - 1, Math.min(input.dueDay, ultimoDia))),
    });
  }

  return salida;
}
