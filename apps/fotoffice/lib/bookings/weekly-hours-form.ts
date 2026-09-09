import { minuteOfDayToLabel } from "./time";
import type { WeeklyHour } from "./availability";

/**
 * Reglas del editor visual de días y horarios. Módulo PURO: sin base, sin red y sin React.
 *
 * La validación que decide si un espacio se guarda o no sigue viviendo en `space-form.ts`,
 * del lado del servidor: es la única que no se puede saltear. Lo que hay acá es lo que el
 * editor necesita para *ofrecer solamente opciones válidas* y avisar antes de guardar. Está
 * separado del componente para poder probarlo sin navegador —las cuentas de la grilla son
 * justamente lo que más se equivoca a ojo.
 */

/** Un tramo del día, en minutos desde la medianoche local. 540 = 09:00. */
export type HourRange = { start: number; end: number };

/** Los siete días, domingo primero, cada uno con sus tramos ordenados. */
export type WeekRanges = HourRange[][];

export const WEEKDAY_NAMES = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export const WEEKDAY_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** 24:00. El servidor acepta esta hora como fin de un tramo que llega hasta la medianoche. */
export const END_OF_DAY = 24 * 60;

const DURACION_SUGERIDA = 4 * 60;

function orden(tramos: HourRange[]): HourRange[] {
  return [...tramos].sort((a, b) => a.start - b.start || a.end - b.end);
}

function pasoValido(stepMinutes: number): number {
  return Number.isFinite(stepMinutes) && stepMinutes > 0 ? Math.floor(stepMinutes) : 60;
}

function alinearArriba(minuto: number, paso: number): number {
  return Math.ceil(minuto / paso) * paso;
}

/** Los horarios guardados, repartidos en los siete días. */
export function toWeekRanges(hours: WeeklyHour[]): WeekRanges {
  const semana: WeekRanges = [[], [], [], [], [], [], []];
  for (const h of hours) {
    if (h.weekday < 0 || h.weekday > 6) continue;
    semana[h.weekday]!.push({ start: h.startMinute, end: h.endMinute });
  }
  return semana.map(orden);
}

/** "09:00-13:00", tal como lo espera `parseSpaceForm`. */
export function formatRange(rango: HourRange): string {
  return `${minuteOfDayToLabel(rango.start)}-${minuteOfDayToLabel(rango.end)}`;
}

/**
 * Las horas que ofrece un desplegable.
 *
 * `incluir` mete a la fuerza valores que ya están guardados aunque no caigan en la grilla:
 * cambiar la grilla no tiene por qué borrar en silencio un horario que alguien cargó.
 */
export function timeOptions(stepMinutes: number, incluir: number[] = []): number[] {
  const paso = pasoValido(stepMinutes);
  const opciones = new Set<number>();
  for (let m = 0; m <= END_OF_DAY; m += paso) opciones.add(m);
  opciones.add(END_OF_DAY);
  for (const extra of incluir) {
    if (Number.isFinite(extra) && extra >= 0 && extra <= END_OF_DAY) opciones.add(extra);
  }
  return [...opciones].sort((a, b) => a - b);
}

/** Horas de inicio. Las 24:00 no se ofrecen: ningún tramo puede empezar cuando el día terminó. */
export function startOptions(stepMinutes: number, incluir: number[] = []): number[] {
  return timeOptions(stepMinutes, incluir).filter((m) => m < END_OF_DAY);
}

/** Horas de fin: sólo las que dejan un tramo de al menos la duración mínima. */
export function endOptions(
  stepMinutes: number,
  start: number,
  minBookingMinutes: number,
  incluir: number[] = [],
): number[] {
  const minimo = start + Math.max(1, minBookingMinutes);
  return timeOptions(stepMinutes, incluir).filter(
    (m) => m >= minimo || incluir.includes(m),
  );
}

/**
 * El tramo que propone el botón "+": arranca donde terminó el último y dura lo razonable.
 *
 * Nunca se superpone con lo que ya hay. Devuelve `null` si no queda día por delante.
 */
export function nextRangeFor(
  tramos: HourRange[],
  stepMinutes: number,
  minBookingMinutes: number,
): HourRange | null {
  const paso = pasoValido(stepMinutes);
  const minimo = Math.max(paso, minBookingMinutes > 0 ? minBookingMinutes : paso);
  const duracion = Math.max(minimo, alinearArriba(DURACION_SUGERIDA, paso));

  const ultimo = tramos.length > 0 ? Math.max(...tramos.map((t) => t.end)) : null;
  const start = ultimo === null ? alinearArriba(9 * 60, paso) : alinearArriba(ultimo, paso);
  if (start >= END_OF_DAY) return null;

  const end = Math.min(start + duracion, END_OF_DAY);
  if (end - start < minimo) return null;
  return { start, end };
}

/** Los índices de los tramos que pisan a otro del mismo día. */
export function overlappingIndexes(tramos: HourRange[]): number[] {
  const pisados = new Set<number>();
  for (let i = 0; i < tramos.length; i += 1) {
    for (let j = i + 1; j < tramos.length; j += 1) {
      const a = tramos[i]!;
      const b = tramos[j]!;
      if (a.start < b.end && b.start < a.end) {
        pisados.add(i);
        pisados.add(j);
      }
    }
  }
  return [...pisados].sort((a, b) => a - b);
}

/**
 * El mismo "no" que daría el servidor, dicho antes de guardar.
 *
 * Se repite a propósito: sin esto, el error aparece recién después de perder el viaje al
 * servidor y sin señalar cuál de los catorce tramos es el que está mal.
 */
export function rangeIssue(
  rango: HourRange,
  reglas: { slotMinutes: number; minBookingMinutes: number },
): string | null {
  const paso = pasoValido(reglas.slotMinutes);
  if (rango.end <= rango.start) return "El fin tiene que ser posterior al inicio.";
  if (rango.start % paso !== 0) {
    return `No arranca en la grilla de ${paso} minutos: no ofrecería ningún turno.`;
  }
  if (reglas.minBookingMinutes > 0 && rango.end - rango.start < reglas.minBookingMinutes) {
    return `Es más corto que la duración mínima de ${reglas.minBookingMinutes} minutos.`;
  }
  return null;
}

/** Copia los tramos de un día a otros. Reemplaza: el día destino queda igual al de origen. */
export function copyDayTo(semana: WeekRanges, origen: number, destinos: number[]): WeekRanges {
  const tramos = semana[origen] ?? [];
  return semana.map((dia, weekday) =>
    destinos.includes(weekday) && weekday !== origen
      ? tramos.map((t) => ({ ...t }))
      : dia,
  );
}
