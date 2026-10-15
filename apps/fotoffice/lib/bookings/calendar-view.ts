import { addMinutes, localMoment, type Interval } from "./time";

/**
 * Lo que necesita la agenda con forma de calendario. Módulo PURO: sin base y sin red.
 *
 * ── Fechas como texto ──
 *
 * La navegación (el mes en miniatura, las flechas, "Hoy") trabaja con días de calendario
 * —"2026-10-03"— y no con instantes. Un día de calendario no tiene zona: sumarle una semana
 * o pasar de mes es aritmética de almanaque, y se hace en UTC puro para que ningún cambio de
 * huso la corra. La zona aparece una sola vez, al pedirle a la base el rango de instantes.
 */

export type CalendarView = "dia" | "semana" | "mes";

export const CALENDAR_VIEWS: CalendarView[] = ["dia", "semana", "mes"];

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const DIA_MS = 24 * 60 * 60_000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** "2026-10-03" → medianoche UTC de ese día. Sólo para aritmética de almanaque. */
function aUtc(ymd: string): Date {
  const m = YMD.exec(ymd);
  if (!m) throw new Error(`Fecha inválida: ${ymd}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function deUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function isValidYmd(ymd: string | undefined | null): ymd is string {
  if (!ymd || !YMD.test(ymd)) return false;
  return deUtc(aUtc(ymd)) === ymd;
}

export function addDaysYmd(ymd: string, days: number): string {
  return deUtc(new Date(aUtc(ymd).getTime() + days * DIA_MS));
}

/** Lunes = 0 … domingo = 6. La semana de la agenda arranca el lunes. */
export function weekdayIndexYmd(ymd: string): number {
  return (aUtc(ymd).getUTCDay() + 6) % 7;
}

export function mondayOfYmd(ymd: string): string {
  return addDaysYmd(ymd, -weekdayIndexYmd(ymd));
}

/** Primer día del mes, corrido `months` meses. Siempre día 1: el 31 no existe en todos. */
export function firstOfMonthYmd(ymd: string, months = 0): string {
  const d = aUtc(ymd);
  return deUtc(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1)));
}

/** A dónde llevan las flechas: un día, una semana o un mes según lo que se mira. */
export function shiftYmd(view: CalendarView, ymd: string, steps: number): string {
  if (view === "dia") return addDaysYmd(ymd, steps);
  if (view === "semana") return addDaysYmd(ymd, steps * 7);
  return firstOfMonthYmd(ymd, steps);
}

/**
 * Los días que dibuja una vista, de lunes a domingo.
 *
 * El mes se dibuja en semanas enteras —con los días del mes anterior y del siguiente que
 * completan la primera y la última fila—, como cualquier almanaque de pared. Son 5 o 6 filas
 * según cómo caiga el mes, no siempre 6: una fila entera de días ajenos sólo distrae.
 */
export function visibleDays(view: CalendarView, ymd: string): string[] {
  if (view === "dia") return [ymd];
  if (view === "semana") {
    const lunes = mondayOfYmd(ymd);
    return Array.from({ length: 7 }, (_, i) => addDaysYmd(lunes, i));
  }
  const primero = firstOfMonthYmd(ymd);
  const siguiente = firstOfMonthYmd(ymd, 1);
  const dias: string[] = [];
  for (let d = mondayOfYmd(primero); d < siguiente || dias.length % 7 !== 0; d = addDaysYmd(d, 1)) {
    dias.push(d);
  }
  return dias;
}

/** Las seis filas del mes en miniatura. Fijas en seis para que el recuadro no salte de alto. */
export function miniMonthWeeks(monthYmd: string): string[][] {
  const desde = mondayOfYmd(firstOfMonthYmd(monthYmd));
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => addDaysYmd(desde, w * 7 + i)),
  );
}

export function sameMonthYmd(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function dayNumberYmd(ymd: string): number {
  return Number(ymd.slice(8, 10));
}

export function monthLabelYmd(ymd: string): string {
  return `${MESES[Number(ymd.slice(5, 7)) - 1]} de ${ymd.slice(0, 4)}`;
}

/**
 * El título de arriba, como lo escribe Google: "octubre de 2026", y cuando la semana cruza
 * de mes, "sept – oct de 2026" (o con los dos años si cruza el fin de año).
 */
export function calendarTitle(view: CalendarView, ymd: string): string {
  if (view === "dia") {
    return `${dayNumberYmd(ymd)} de ${MESES[Number(ymd.slice(5, 7)) - 1]} de ${ymd.slice(0, 4)}`;
  }
  if (view === "mes") return monthLabelYmd(ymd);

  const dias = visibleDays("semana", ymd);
  const [a, b] = [dias[0], dias[6]];
  if (sameMonthYmd(a, b)) return monthLabelYmd(a);
  const corto = (x: string) => MESES[Number(x.slice(5, 7)) - 1].slice(0, 3);
  if (a.slice(0, 4) === b.slice(0, 4)) return `${corto(a)} – ${corto(b)} de ${b.slice(0, 4)}`;
  return `${corto(a)} de ${a.slice(0, 4)} – ${corto(b)} de ${b.slice(0, 4)}`;
}

/** El día de calendario de un instante, en la zona de la institución. */
export function ymdOf(at: Date, timeZone: string): string {
  return localMoment(at, timeZone).ymd;
}

/**
 * La medianoche local de un día de calendario, como instante.
 *
 * Se parte del mediodía UTC de ese día —que cae dentro del mismo día en cualquier zona
 * habitada de América— y se le resta lo que el reloj local marca a esa hora. Así no hay una
 * resta de tres horas escrita a mano: si el huso cambia, lo resuelve la base de zonas.
 */
export function startOfLocalDay(ymd: string, timeZone: string): Date {
  const mediodia = new Date(aUtc(ymd).getTime() + 12 * 60 * 60_000);
  return addMinutes(mediodia, -localMoment(mediodia, timeZone).minuteOfDay);
}

/** Los instantes que cubre una vista: del primer día a la medianoche siguiente al último. */
export function viewInterval(view: CalendarView, ymd: string, timeZone: string): Interval {
  const dias = visibleDays(view, ymd);
  return {
    startAt: startOfLocalDay(dias[0], timeZone),
    endAt: startOfLocalDay(addDaysYmd(dias[dias.length - 1], 1), timeZone),
  };
}

/**
 * Lo que dice la dirección. Acepta el `?semana=<instante>` de antes para que los enlaces
 * viejos sigan andando, y cualquier cosa rara vuelve a hoy en vez de romper la pantalla.
 */
export function parseCalendarParams(
  params: { fecha?: string; vista?: string; semana?: string },
  now: Date,
  timeZone: string,
  defaultView: CalendarView = "semana",
): { ymd: string; view: CalendarView } {
  const view = CALENDAR_VIEWS.includes(params.vista as CalendarView)
    ? (params.vista as CalendarView)
    : defaultView;

  if (isValidYmd(params.fecha)) return { ymd: params.fecha, view };

  if (params.semana) {
    const ancla = new Date(params.semana);
    if (!Number.isNaN(ancla.getTime())) return { ymd: ymdOf(ancla, timeZone), view };
  }
  return { ymd: ymdOf(now, timeZone), view };
}

/**
 * De qué hora a qué hora se dibuja la grilla.
 *
 * Abarca el horario de todos los espacios, redondeado a horas enteras, y se estira si alguna
 * reserva cae afuera —una carga manual a las 22, por ejemplo—: una reserva que existe tiene
 * que verse siempre, aunque esté fuera del horario declarado.
 */
export function hourBounds(
  weeklyMinutes: { startMinute: number; endMinute: number }[],
  eventMinutes: { startMinute: number; endMinute: number }[],
  fallback: { startHour: number; endHour: number } = { startHour: 8, endHour: 20 },
): { startHour: number; endHour: number } {
  const todos = [...weeklyMinutes, ...eventMinutes];
  if (todos.length === 0) return fallback;
  const desde = Math.floor(Math.min(...todos.map((t) => t.startMinute)) / 60);
  const hasta = Math.ceil(Math.max(...todos.map((t) => t.endMinute)) / 60);
  return { startHour: Math.max(0, desde), endHour: Math.min(24, Math.max(hasta, desde + 1)) };
}

/**
 * Columnas para reservas que se pisan en el mismo día.
 *
 * Dos espacios distintos pueden estar reservados a la misma hora. Como en cualquier agenda,
 * se dibujan lado a lado: cada grupo de reservas que se tocan entre sí se reparte el ancho en
 * tantas columnas como reservas simultáneas tenga como máximo.
 */
export function layoutOverlaps<T extends { startMinute: number; endMinute: number }>(
  events: T[],
): (T & { column: number; columns: number })[] {
  const orden = [...events].sort(
    (a, b) => a.startMinute - b.startMinute || b.endMinute - a.endMinute,
  );
  const salida: (T & { column: number; columns: number })[] = [];

  let grupo: (T & { column: number; columns: number })[] = [];
  let finDelGrupo = -1;
  const cerrarGrupo = () => {
    const columnas = Math.max(1, ...grupo.map((g) => g.column + 1));
    for (const g of grupo) g.columns = columnas;
    salida.push(...grupo);
    grupo = [];
  };

  for (const ev of orden) {
    if (grupo.length > 0 && ev.startMinute >= finDelGrupo) cerrarGrupo();
    // La primera columna cuyo último ocupante ya terminó.
    let columna = 0;
    while (grupo.some((g) => g.column === columna && g.endMinute > ev.startMinute)) columna += 1;
    grupo.push({ ...ev, column: columna, columns: 1 });
    finDelGrupo = Math.max(finDelGrupo, ev.endMinute);
  }
  if (grupo.length > 0) cerrarGrupo();
  return salida;
}

/** La dirección de una vista, conservando los demás parámetros (el espacio elegido, etc.). */
export function calendarHref(
  basePath: string,
  target: { ymd: string; view?: CalendarView },
  keep: Record<string, string | undefined> = {},
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(keep)) if (v) q.set(k, v);
  q.set("fecha", target.ymd);
  if (target.view) q.set("vista", target.view);
  return `${basePath}?${q.toString()}`;
}

/**
 * Paleta de los espacios. Ocho tonos de fondo lleno con texto blanco legible, elegidos para
 * distinguirse entre sí y del celeste de acento, que queda para "hoy" y para la selección.
 */
export const SPACE_COLORS = [
  "#6366f1",
  "#10b981",
  "#f97316",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#ca8a04",
  "#64748b",
];

export function spaceColor(index: number): string {
  return SPACE_COLORS[((index % SPACE_COLORS.length) + SPACE_COLORS.length) % SPACE_COLORS.length];
}
