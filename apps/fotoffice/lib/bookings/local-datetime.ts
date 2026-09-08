/**
 * El texto de un campo `datetime-local` → el instante que corresponde. PURO.
 *
 * ── Por qué no alcanza `new Date(texto)` ──
 *
 * El navegador manda "2026-09-19T14:00", SIN zona horaria. `new Date()` lo interpreta en la
 * hora del servidor, que en Vercel es UTC: una reserva cargada a las 14 quedaría guardada a
 * las 11 de Rosario, y nadie se daría cuenta hasta que alguien llegara tres horas tarde.
 *
 * Se resuelve probando un instante candidato y corrigiéndolo con la diferencia que reporta
 * la zona. Es la forma de hacerlo sin sumar una biblioteca de fechas al proyecto, y funciona
 * también cuando la zona cambia de huso, porque la diferencia se pregunta para ESE instante.
 */

export function parseLocalDateTime(texto: string, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(texto.trim());
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return null;

  // Primer intento: interpretarlo como si el texto fuera UTC.
  const candidato = Date.UTC(y, mo - 1, d, h, mi);

  // Qué hora local muestra ese instante. La diferencia es el desfasaje a corregir.
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(candidato));
  const p = Object.fromEntries(partes.map((x) => [x.type, Number(x.value)])) as Record<
    string,
    number
  >;
  const comoLocal = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute);

  const instante = new Date(candidato - (comoLocal - candidato));
  return Number.isNaN(instante.getTime()) ? null : instante;
}
