/**
 * Alta sin aprobación y renovación sin deuda — la parte pura.
 *
 * Nació con el VIP de una barbería: la persona se hace VIP sola desde el sitio, paga, y después
 * renueva cuando quiere. Si un mes no paga no debe nada: simplemente ese mes no tiene cortes.
 * Todo se enciende por institución o por categoría; apagado, el alta y las cuotas funcionan
 * como siempre (la SFPR aprueba a mano y genera la cuota el día 1).
 */

/** Las renovaciones son cargos `OTRO` con este prefijo: no cuentan como cuota MENSUAL (mora). */
export const RENEWAL_PERIOD_PREFIX = "RENOV-";

export function isRenewalPeriod(period: string | null | undefined): boolean {
  return Boolean(period?.startsWith(RENEWAL_PERIOD_PREFIX));
}

/**
 * El período de una renovación: único por momento ("RENOV-20261013-153045"), así dos
 * renovaciones del mismo mes no chocan con la restricción única de cargos (socio + concepto +
 * período). La hora es la de Argentina, que es la que se lee en el historial.
 */
export function renewalPeriodFor(now: Date): string {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? "00";
  return `${RENEWAL_PERIOD_PREFIX}${v("year")}${v("month")}${v("day")}-${v("hour")}${v("minute")}${v("second")}`;
}

/**
 * El formulario corto pide sólo nombre, apellido, email y teléfono. Lo que el completo exige
 * por estatuto (domicilio de notificaciones, condición) no aplica a un club de clientes, y se
 * completa con valores neutros para que la validación común siga siendo una sola.
 */
export function withSimpleFormDefaults(raw: Record<string, string>): Record<string, string> {
  return {
    ...raw,
    noticeAddress: raw.noticeAddress?.trim() || "No corresponde (alta simplificada)",
    declaredFeeScale: raw.declaredFeeScale?.trim() || "PLENA",
  };
}

/**
 * Cargos de renovación abandonados: la persona apretó "Renovar", no pagó, y el cargo quedó
 * intacto (sin ningún pago imputado). Se borran pasado un plazo para que no figure como deuda.
 */
export function isAbandonedRenewal(input: {
  period: string;
  amountMinor: number;
  balanceMinor: number;
  createdAt: Date;
  hasAllocations: boolean;
  now: Date;
  graceHours: number;
}): boolean {
  if (!isRenewalPeriod(input.period)) return false;
  if (input.hasAllocations || input.balanceMinor !== input.amountMinor) return false;
  return input.now.getTime() - input.createdAt.getTime() >= input.graceHours * 60 * 60 * 1000;
}
