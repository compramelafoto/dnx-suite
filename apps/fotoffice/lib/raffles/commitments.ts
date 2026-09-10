import { parseLocalDateTime } from "@/lib/bookings/local-datetime";
import { RAFFLES_TIME_ZONE } from "./constants";

/**
 * Los premios que un aliado se comprometió a dar todos los meses, y el plan del sorteo mensual.
 *
 * Módulo PURO: sin base y sin red.
 *
 * Un compromiso es un acuerdo: «Arte en Foco da 50% OFF en cursos seleccionados todos los
 * meses hasta diciembre de 2026». No es un premio: es la razón por la que cada mes aparece
 * uno. Los premios que genera son copias independientes — si el aliado cambia de dirección en
 * noviembre, el premio de septiembre sigue diciendo dónde había que ir en septiembre.
 *
 * Los períodos son `YYYY-MM` y el de fin es INCLUSIVE: «hasta diciembre» incluye diciembre.
 * Es como lo dice la gente, y como se firma un acuerdo.
 */

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
] as const;

export type Commitment = {
  id: string;
  title: string;
  /** `YYYY-MM` del primer sorteo que lo incluye. */
  startPeriod: string;
  /** `YYYY-MM` del último, inclusive. `null` = sin fin previsto. */
  endPeriod: string | null;
  cancelledAt: Date | null;
};

/** `2026-09` → 24_321. Un número por mes, para comparar sin pensar en años. */
function aIndice(period: string): number {
  const [a, m] = period.split("-").map(Number);
  return a * 12 + (m - 1);
}

/** El mes de una fecha, leído en hora argentina y no en la del servidor. */
export function periodOf(d: Date): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: RAFFLES_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value])) as Record<string, string>;
  return `${p.year}-${p.month}`;
}

/** El mes siguiente. Diciembre pasa a enero del año próximo. */
export function nextPeriod(period: string): string {
  const i = aIndice(period) + 1;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
}

/** Los compromisos que corresponde incluir en el sorteo de ese mes. */
export function activeCommitmentsFor<T extends Commitment>(
  commitments: readonly T[],
  period: string,
): T[] {
  const mes = aIndice(period);
  return commitments.filter((c) => {
    if (c.cancelledAt !== null) return false;
    if (aIndice(c.startPeriod) > mes) return false;
    // Sin fin, sigue vigente. Con fin, el mes de fin todavía cuenta.
    return c.endPeriod === null || aIndice(c.endPeriod) >= mes;
  });
}

/**
 * Cuántos sorteos le quedan al compromiso, contando el del mes que se mira.
 *
 * `null` cuando no tiene fin: no hay número que dar, y mostrar «∞» sería inventar una promesa
 * que nadie hizo.
 */
export function monthsRemaining(c: Commitment, fromPeriod: string): number | null {
  if (c.endPeriod === null) return null;
  return Math.max(0, aIndice(c.endPeriod) - aIndice(fromPeriod) + 1);
}

export type MonthlyRules = {
  /** Día del mes del acto. Si el mes no llega a ese día, se usa el último. */
  drawDay: number;
  /** Hora del acto, en hora argentina. */
  drawHour: number;
  entriesCloseHoursBefore: number;
};

export type MonthlyPlan = {
  period: string;
  title: string;
  entriesCloseAt: Date;
  drawsAt: Date;
};

/**
 * El sorteo que corresponde a un mes.
 *
 * El día se recorta al último del mes: un sorteo pactado «el 30» en febrero cae el 28 —o el
 * 29 si el año es bisiesto— y no se desborda a marzo, que es lo que haría una suma de días.
 */
export function planMonthlyRaffle(period: string, rules: MonthlyRules): MonthlyPlan {
  const [anio, mes] = period.split("-").map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  const dia = Math.min(rules.drawDay, ultimoDia);

  const texto = `${period}-${String(dia).padStart(2, "0")}T${String(rules.drawHour).padStart(2, "0")}:00`;
  const drawsAt = parseLocalDateTime(texto, RAFFLES_TIME_ZONE);
  if (!drawsAt) throw new Error(`No se pudo armar la fecha del sorteo de ${period}.`);

  return {
    period,
    title: `Sorteo de ${MESES[mes - 1]} de ${anio}`,
    entriesCloseAt: new Date(drawsAt.getTime() - rules.entriesCloseHoursBefore * 3_600_000),
    drawsAt,
  };
}
