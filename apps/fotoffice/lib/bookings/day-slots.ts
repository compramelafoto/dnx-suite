import { localMoment, minuteOfDayToLabel, type Interval } from "./time";

/**
 * Los horarios de entrada de cada día. Módulo PURO: sin base y sin red.
 *
 * ── Por qué "hora de entrada" y no "casillero" ──
 *
 * La grilla semanal (`week-grid.ts`) pedía dos toques: uno en la hora de inicio y otro en la
 * de fin. Funciona mientras todos los turnos duren lo mismo, pero el salón se alquila por un
 * mínimo de tres horas, y ahí el casillero de una hora pasa a ser una mentira: se puede
 * tocar, y no se puede reservar.
 *
 * Acá cada día ofrece las horas en las que una reserva PUEDE empezar, y cada una sabe hasta
 * dónde se puede estirar. Elegir es entonces "entro a las 19" y después "me quedo 5 horas",
 * que es como lo dice quien alquila.
 *
 * La entrada son los huecos que ya calculó `computeAvailability`: intervalos de la duración
 * mínima que arrancan cada `slotMinutes`. Que exista un hueco en `t + paso` prueba que desde
 * `t` se puede reservar un paso más. Por eso estirar no vuelve a preguntarle a la
 * disponibilidad: se deduce de lo que la disponibilidad ya dijo, y no puede discrepar.
 */

export type StartOption = {
  startISO: string;
  /** Minutos desde la medianoche local. 540 = 09:00. */
  minuteOfDay: number;
  /** "09:00" */
  label: string;
  /** Cuántos minutos seguidos se pueden reservar desde acá, con el tope del espacio ya aplicado. */
  maxMinutes: number;
};

export type DayOffer = {
  /** "2026-09-12" */
  ymd: string;
  /** "sáb" */
  weekdayLabel: string;
  /** "12" */
  dayNumber: string;
  starts: StartOption[];
};

const MINUTO = 60_000;

export function buildDayOffers(input: {
  slots: Interval[];
  timeZone: string;
  slotMinutes: number;
  minBookingMinutes: number;
  maxBookingMinutes: number | null;
}): DayOffer[] {
  const paso = input.slotMinutes > 0 ? input.slotMinutes : 60;
  // La misma cuenta que hace `computeAvailability` al armar los huecos. Si las dos no
  // coinciden, la pantalla ofrecería duraciones que la validación después rechaza.
  const minima = Math.max(input.minBookingMinutes, paso);
  const tope =
    input.maxBookingMinutes !== null && input.maxBookingMinutes >= minima
      ? input.maxBookingMinutes
      : null;

  const porDia = new Map<string, Date[]>();
  for (const slot of input.slots) {
    const { ymd } = localMoment(slot.startAt, input.timeZone);
    const lista = porDia.get(ymd);
    if (lista) lista.push(slot.startAt);
    else porDia.set(ymd, [slot.startAt]);
  }

  const fmtDia = new Intl.DateTimeFormat("es-AR", {
    timeZone: input.timeZone,
    weekday: "short",
  });
  const fmtNumero = new Intl.DateTimeFormat("es-AR", {
    timeZone: input.timeZone,
    day: "numeric",
  });

  const dias: DayOffer[] = [];
  for (const [ymd, comienzos] of porDia) {
    comienzos.sort((a, b) => a.getTime() - b.getTime());
    const tiempos = comienzos.map((d) => d.getTime());
    const posicion = new Map(tiempos.map((t, i) => [t, i]));

    // De atrás para adelante: cuántos pasos seguidos hay después de cada comienzo. Un solo
    // recorrido en vez de buscar la corrida entera desde cada uno.
    const seguidos = new Array<number>(tiempos.length).fill(0);
    for (let i = tiempos.length - 1; i >= 0; i -= 1) {
      const siguiente = posicion.get(tiempos[i]! + paso * MINUTO);
      seguidos[i] = siguiente === undefined ? 0 : seguidos[siguiente]! + 1;
    }

    const starts: StartOption[] = comienzos.map((at, i) => {
      const estirable = minima + seguidos[i]! * paso;
      return {
        startISO: at.toISOString(),
        minuteOfDay: localMoment(at, input.timeZone).minuteOfDay,
        label: minuteOfDayToLabel(localMoment(at, input.timeZone).minuteOfDay),
        maxMinutes: tope === null ? estirable : Math.min(estirable, tope),
      };
    });

    dias.push({
      ymd,
      weekdayLabel: fmtDia.format(comienzos[0]!).replace(".", ""),
      dayNumber: fmtNumero.format(comienzos[0]!),
      starts,
    });
  }

  return dias.sort((a, b) => a.ymd.localeCompare(b.ymd));
}

/** Las duraciones que ofrece el selector, de la mínima a lo que dé el día. */
export function durationOptions(
  maxMinutes: number,
  minBookingMinutes: number,
  slotMinutes: number,
): number[] {
  const paso = slotMinutes > 0 ? slotMinutes : 60;
  const minima = Math.max(minBookingMinutes, paso);
  const opciones: number[] = [];
  for (let m = minima; m <= maxMinutes; m += paso) opciones.push(m);
  return opciones.length > 0 ? opciones : [minima];
}

/** "5 h", "1,5 h". Las medias horas se escriben con coma, que es como se leen acá. */
export function hoursLabel(minutos: number): string {
  const h = minutos / 60;
  return `${Number.isInteger(h) ? String(h) : h.toFixed(1).replace(".", ",")} h`;
}
