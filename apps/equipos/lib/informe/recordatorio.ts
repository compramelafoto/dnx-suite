const TZ = "America/Argentina/Buenos_Aires";
const DAY_MS = 24 * 3600 * 1000;
const AVISO_DIAS_ANTES = 30;
const MIN_DIAS_ENTRE_AVISOS = 300;

/** Día calendario de Argentina como [año, mes (1-12), día]. */
function diaAr(d: Date): [number, number, number] {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(d).split("-").map(Number);
  return [p[0], p[1], p[2]];
}

const esBisiesto = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/**
 * Próximo aniversario (mes y día) de la renovación, desde hoy (día de Argentina) inclusive.
 * Devuelve mediodía UTC, que cae el mismo día calendario en Argentina. El 29-feb pasa al 28 en años comunes.
 */
export function nextRenewalAnniversary(renewal: Date, now: Date): Date {
  const [, rm, rd] = diaAr(renewal);
  const [ny, nm, nd] = diaAr(now);
  const hoy = Date.UTC(ny, nm - 1, nd);
  for (const y of [ny, ny + 1]) {
    const dia = rm === 2 && rd === 29 && !esBisiesto(y) ? 28 : rd;
    const cand = Date.UTC(y, rm - 1, dia);
    if (cand >= hoy) return new Date(cand + 12 * 3600 * 1000);
  }
  return new Date(Date.UTC(ny + 1, rm - 1, rd, 12));
}

/**
 * ¿Hoy (día de Argentina) es 30 días antes del aniversario (mes y día) de la renovación, y
 * pasaron más de 300 días desde el último aviso? El 29 de febrero se festeja el 28 en años comunes.
 */
export function isRenewalReminderDue(renewal: Date, now: Date, lastSent: Date | null): boolean {
  if (lastSent && now.getTime() - lastSent.getTime() <= MIN_DIAS_ENTRE_AVISOS * DAY_MS) {
    return false;
  }
  const [, rm, rd] = diaAr(renewal);
  const [ny, nm, nd] = diaAr(now);
  // Aritmética de calendario en UTC: maneja bien el cambio de mes y de año.
  const objetivo = new Date(Date.UTC(ny, nm - 1, nd) + AVISO_DIAS_ANTES * DAY_MS);
  const ty = objetivo.getUTCFullYear();
  const tm = objetivo.getUTCMonth() + 1;
  const td = objetivo.getUTCDate();
  if (tm === rm && td === rd) return true;
  return rm === 2 && rd === 29 && !esBisiesto(ty) && tm === 2 && td === 28;
}
