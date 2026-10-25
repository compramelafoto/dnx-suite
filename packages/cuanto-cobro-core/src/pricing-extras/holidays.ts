/**
 * Feriados nacionales de Argentina (Ley 27.399), calculados por regla. PURO: sin red ni reloj.
 *
 * - Inamovibles: en su fecha.
 * - Carnaval (lunes y martes) y Viernes Santo: dependen de la Pascua.
 * - Trasladables (17/6, 17/8, 12/10, 20/11): martes y miércoles pasan al lunes anterior; jueves y
 *   viernes, al lunes siguiente; el resto queda en su día. El Gobierno puede decidir otra cosa por
 *   decreto: va en `EXCEPCIONES_POR_ANIO`.
 * - Días no laborables con fines turísticos: los fija un decreto cada año (`EXCEPCIONES_POR_ANIO`).
 *   No son feriados (el empleador decide): no llevan recargo de feriado, sólo se avisan.
 *
 * Al empezar diciembre hay que cargar las excepciones del año siguiente cuando salga el decreto.
 */

export type HolidayKind = "holiday" | "non-working";
export type ArgentinaHoliday = { date: string; name: string; kind: HolidayKind };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;

function toUtc(date: string): Date {
  return new Date(`${date}T12:00:00Z`);
}

function addDays(date: string, days: number): string {
  const d = toUtc(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "AAAA-MM-DD" que existe en el calendario. */
export function isValidYmd(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = toUtc(v);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
export function easterSunday(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return ymd(year, month, day);
}

/** Traslado de la Ley 27.399. */
function movable(date: string): string {
  const dow = toUtc(date).getUTCDay(); // 0 = domingo
  if (dow === 2) return addDays(date, -1);
  if (dow === 3) return addDays(date, -2);
  if (dow === 4) return addDays(date, 4);
  if (dow === 5) return addDays(date, 3);
  return date;
}

/** Lo que fija cada año un decreto. `moved`: trasladables que el decreto dejó en otra fecha. */
const EXCEPCIONES_POR_ANIO: Record<number, { nonWorking: { date: string; name: string }[]; moved?: Record<string, string> }> = {
  // Decreto 614/2025.
  2026: {
    nonWorking: [
      { date: "2026-03-23", name: "Día no laborable con fines turísticos" },
      { date: "2026-07-10", name: "Día no laborable con fines turísticos" },
      { date: "2026-12-07", name: "Día no laborable con fines turísticos" },
    ],
  },
};

/** Años con las excepciones (decreto) cargadas. */
export const ARGENTINA_HOLIDAY_YEARS_WITH_DECREE: readonly number[] = Object.keys(EXCEPCIONES_POR_ANIO).map(Number);

export function argentinaHolidays(year: number): ArgentinaHoliday[] {
  const easter = easterSunday(year);
  const exc = EXCEPCIONES_POR_ANIO[year];
  const mover = (original: string) => exc?.moved?.[original] ?? movable(original);
  const list: ArgentinaHoliday[] = [
    { date: ymd(year, 1, 1), name: "Año Nuevo", kind: "holiday" },
    { date: addDays(easter, -48), name: "Carnaval", kind: "holiday" },
    { date: addDays(easter, -47), name: "Carnaval", kind: "holiday" },
    { date: ymd(year, 3, 24), name: "Día Nacional de la Memoria por la Verdad y la Justicia", kind: "holiday" },
    { date: ymd(year, 4, 2), name: "Día del Veterano y de los Caídos en la Guerra de Malvinas", kind: "holiday" },
    { date: addDays(easter, -2), name: "Viernes Santo", kind: "holiday" },
    { date: ymd(year, 5, 1), name: "Día del Trabajador", kind: "holiday" },
    { date: ymd(year, 5, 25), name: "Día de la Revolución de Mayo", kind: "holiday" },
    { date: mover(ymd(year, 6, 17)), name: "Paso a la Inmortalidad del General Martín Miguel de Güemes", kind: "holiday" },
    { date: ymd(year, 6, 20), name: "Paso a la Inmortalidad del General Manuel Belgrano", kind: "holiday" },
    { date: ymd(year, 7, 9), name: "Día de la Independencia", kind: "holiday" },
    { date: mover(ymd(year, 8, 17)), name: "Paso a la Inmortalidad del General José de San Martín", kind: "holiday" },
    { date: mover(ymd(year, 10, 12)), name: "Día del Respeto a la Diversidad Cultural", kind: "holiday" },
    { date: mover(ymd(year, 11, 20)), name: "Día de la Soberanía Nacional", kind: "holiday" },
    { date: ymd(year, 12, 8), name: "Inmaculada Concepción de María", kind: "holiday" },
    { date: ymd(year, 12, 25), name: "Navidad", kind: "holiday" },
    ...(exc?.nonWorking ?? []).map((n) => ({ ...n, kind: "non-working" as const })),
  ];
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export type EventDayType = "weekday" | "saturday" | "sunday" | "holiday";

export type EventDayInfo = {
  date: string;
  dayType: EventDayType;
  holidayName: string | null;
  isSaturday: boolean;
  isSunday: boolean;
  /** Día no laborable con fines turísticos: sin recargo de feriado. */
  nonWorkingDay: boolean;
};

/** Qué día es el evento. `extraHolidays`: fechas propias del perfil (feriados locales). null si la fecha no es válida. */
export function eventDayType(date: string, extraHolidays: readonly string[] = []): EventDayInfo | null {
  if (!isValidYmd(date)) return null;
  const dow = toUtc(date).getUTCDay();
  const year = Number(date.slice(0, 4));
  const found = argentinaHolidays(year).filter((h) => h.date === date);
  const holiday = found.find((h) => h.kind === "holiday");
  const own = extraHolidays.includes(date);
  const isSaturday = dow === 6;
  const isSunday = dow === 0;
  const dayType: EventDayType = holiday || own ? "holiday" : isSunday ? "sunday" : isSaturday ? "saturday" : "weekday";
  return {
    date,
    dayType,
    holidayName: holiday?.name ?? (own ? "Feriado propio" : null),
    isSaturday,
    isSunday,
    nonWorkingDay: found.some((h) => h.kind === "non-working"),
  };
}
