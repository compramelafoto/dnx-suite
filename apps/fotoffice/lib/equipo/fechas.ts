/**
 * Fechas y horas del módulo Equipo, siempre en hora argentina. Módulo PURO.
 *
 * Los días se manejan como texto "AAAA-MM-DD" y las horas como minutos desde la medianoche
 * (8:00 = 480). En Vercel el servidor corre en UTC: si se usara la hora del servidor, una
 * apertura a las 22 quedaría en el día siguiente.
 */

export const ZONA_ARGENTINA = "America/Argentina/Buenos_Aires";

/**
 * Argentina no tiene horario de verano desde 2009: siempre es UTC−3. Se usa sólo para pasar de
 * un día a su instante de medianoche; para leer la hora de un instante se usa `Intl`.
 */
const DESFASE_ARGENTINA = "-03:00";

const formatoDiaHora = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONA_ARGENTINA,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** El día ("AAAA-MM-DD") y el minuto del día de un instante, en hora argentina. */
export function diaYMinuto(instante: Date): { fecha: string; minuto: number } {
  const partes = Object.fromEntries(formatoDiaHora.formatToParts(instante).map((p) => [p.type, p.value]));
  const fecha = `${partes.year}-${partes.month}-${partes.day}`;
  const minuto = Number(partes.hour) * 60 + Number(partes.minute);
  return { fecha, minuto };
}

/** El día de hoy en hora argentina. */
export function hoyArgentina(ahora: Date = new Date()): string {
  return diaYMinuto(ahora).fecha;
}

/** El instante de la medianoche de ese día en hora argentina. */
export function medianocheArgentina(fecha: string): Date {
  return new Date(`${fecha}T00:00:00${DESFASE_ARGENTINA}`);
}

/**
 * Minutos desde la medianoche (hora argentina) de `fecha` hasta el instante. Puede pasar de
 * 1440 si el instante es del día siguiente (un turno que se cerró pasada la medianoche).
 */
export function minutosDesdeElDia(fecha: string, instante: Date): number {
  return Math.floor((instante.getTime() - medianocheArgentina(fecha).getTime()) / 60_000);
}

/** Suma días a un "AAAA-MM-DD" (calendario puro, sin husos). */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  const utc = (f: string) => {
    const [y, m, d] = f.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(hasta) - utc(desde)) / 86_400_000);
}

/** Lunes = 0 … domingo = 6. */
export function diaDeSemana(fecha: string): number {
  const [y, m, d] = fecha.split("-").map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

export const NOMBRES_DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const;

/** "AAAA-MM-DD" que existe en el calendario. */
export function esFechaValida(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** "08:30" o "8:30" → 510. Null si no es una hora del día. */
export function leerHora(texto: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(texto.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 510 → "08:30" (para un `<input type="time">`). */
export function horaParaCampo(minutos: number): string {
  const h = Math.floor(minutos / 60) % 24;
  return `${String(h).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** 510 → "8:30"; 1500 (pasada la medianoche) → "1:00 (día siguiente)". */
export function horaLegible(minutos: number): string {
  const dia = Math.floor(minutos / 1440);
  const resto = ((minutos % 1440) + 1440) % 1440;
  const texto = `${Math.floor(resto / 60)}:${String(resto % 60).padStart(2, "0")}`;
  return dia > 0 ? `${texto} (día siguiente)` : texto;
}

/** 95 → "1 h 35 min"; 40 → "40 min"; 120 → "2 h". */
export function duracionLegible(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h === 0) return `${r} min`;
  return r === 0 ? `${h} h` : `${h} h ${r} min`;
}

/** "2026-10-25" → "25/10/2026". */
export function fechaLegible(fecha: string): string {
  return `${fecha.slice(8, 10)}/${fecha.slice(5, 7)}/${fecha.slice(0, 4)}`;
}
