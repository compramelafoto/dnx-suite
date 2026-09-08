import { type Interval, addMinutes, localMoment } from "./time";

/**
 * Armado de la semana de la agenda. Módulo PURO: sin base y sin red.
 *
 * La semana arranca el **lunes**, que es como se lee un calendario acá, y no el domingo,
 * que es como numera los días el estándar. Los dos criterios conviven: `localMoment`
 * devuelve 0 para el domingo porque así lo declaran los horarios semanales; la vista es
 * otra cosa.
 */

const DIA = 24 * 60;

/** De lunes 00:00 local a lunes 00:00 local de la semana siguiente. */
export function weekRange(anchor: Date, timeZone: string): Interval {
  const m = localMoment(anchor, timeZone);
  // weekday 0 = domingo. Cuántos días hay que retroceder para llegar al lunes.
  const atras = m.weekday === 0 ? 6 : m.weekday - 1;
  const inicio = addMinutes(anchor, -(atras * DIA + m.minuteOfDay));
  return { startAt: inicio, endAt: addMinutes(inicio, 7 * DIA) };
}

export function weekDays(range: Interval, timeZone: string): { ymd: string; label: string }[] {
  const fmt = new Intl.DateTimeFormat("es-AR", { timeZone, weekday: "short", day: "numeric" });
  const dias: { ymd: string; label: string }[] = [];
  for (let i = 0; i < 7; i += 1) {
    // Mediodía: inmune a cualquier salto de una hora por cambio de horario.
    const at = addMinutes(range.startAt, i * DIA + 12 * 60);
    dias.push({ ymd: localMoment(at, timeZone).ymd, label: fmt.format(at) });
  }
  return dias;
}

export function shiftWeeks(anchor: Date, weeks: number): Date {
  return addMinutes(anchor, weeks * 7 * DIA);
}
