import { addMinutes, localMoment, type Interval } from "./time";

/**
 * Armado del mes del calendario. Módulo PURO: sin base y sin red.
 *
 * El mes se usa para una sola pregunta: **qué días abre el espacio y le queda lugar**. La
 * hora se elige después, en la tira de días. Separar las dos preguntas es lo que hace que se
 * entienda; mezclarlas era la grilla semanal.
 *
 * Toda la aritmética pasa por el mediodía local antes de moverse de día. Sumar 24 horas en
 * la madrugada del cambio de horario cae en el mismo día o se saltea uno; el mediodía tiene
 * doce horas de colchón a cada lado.
 */

const DIA = 24 * 60;

/** El mediodía local del día al que pertenece este instante. */
function mediodia(at: Date, timeZone: string): Date {
  return addMinutes(at, 12 * 60 - localMoment(at, timeZone).minuteOfDay);
}

/** La medianoche local del día al que pertenece este instante. */
function medianoche(at: Date, timeZone: string): Date {
  return addMinutes(at, -localMoment(at, timeZone).minuteOfDay);
}

function diaDelMes(at: Date, timeZone: string): number {
  return Number(localMoment(at, timeZone).ymd.slice(8, 10));
}

/** Del día 1 a las 00:00 local, al día 1 del mes siguiente a las 00:00 local. */
export function monthRange(anchor: Date, timeZone: string): Interval {
  const primero = addMinutes(mediodia(anchor, timeZone), -(diaDelMes(anchor, timeZone) - 1) * DIA);
  // 32 días caen siempre dentro del mes siguiente, sea de 28 o de 31.
  const dentroDelSiguiente = addMinutes(primero, 32 * DIA);
  const primeroSiguiente = addMinutes(
    dentroDelSiguiente,
    -(diaDelMes(dentroDelSiguiente, timeZone) - 1) * DIA,
  );
  return {
    startAt: medianoche(primero, timeZone),
    endAt: medianoche(primeroSiguiente, timeZone),
  };
}

export function shiftMonths(anchor: Date, months: number, timeZone: string): Date {
  let cursor = mediodia(anchor, timeZone);
  const paso = months >= 0 ? 1 : -1;
  for (let i = 0; i < Math.abs(months); i += 1) {
    const rango = monthRange(cursor, timeZone);
    // Un día adentro del mes vecino, y de ahí su día 1.
    cursor = mediodia(
      paso > 0 ? addMinutes(rango.endAt, 12 * 60) : addMinutes(rango.startAt, -12 * 60),
      timeZone,
    );
  }
  return cursor;
}

/** "septiembre de 2026" */
export function monthLabel(anchor: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("es-AR", { timeZone, month: "long", year: "numeric" }).format(
    anchor,
  );
}

export type MonthCell = {
  /** "2026-09-12" */
  ymd: string;
  /** "12" */
  dayNumber: string;
  /** Los días de relleno del mes anterior y del siguiente se pintan apagados. */
  inMonth: boolean;
};

/**
 * Seis semanas de siete días, **empezando el domingo**.
 *
 * Seis filas siempre, aunque el mes entre en cinco: si la cantidad de filas cambiara al
 * pasar de mes, el resto de la pantalla saltaría de lugar en cada clic.
 */
export function monthGrid(anchor: Date, timeZone: string): MonthCell[] {
  const rango = monthRange(anchor, timeZone);
  const primero = mediodia(rango.startAt, timeZone);
  const atras = localMoment(primero, timeZone).weekday; // 0 domingo
  const arranque = addMinutes(primero, -atras * DIA);

  const mesDelAncla = localMoment(rango.startAt, timeZone).ymd.slice(0, 7);
  const fmt = new Intl.DateTimeFormat("es-AR", { timeZone, day: "numeric" });

  return Array.from({ length: 42 }, (_, i) => {
    const at = addMinutes(arranque, i * DIA);
    const ymd = localMoment(at, timeZone).ymd;
    return { ymd, dayNumber: fmt.format(at), inMonth: ymd.slice(0, 7) === mesDelAncla };
  });
}

export const WEEKDAY_INITIALS = ["D", "L", "M", "M", "J", "V", "S"];
