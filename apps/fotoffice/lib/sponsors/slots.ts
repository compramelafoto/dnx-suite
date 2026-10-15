/**
 * Fechas de las asignaciones de sponsors a espacios. Puro: sin base.
 *
 * La institución piensa en días ("del 1 al 31 de octubre"); la tabla de ocupación guarda
 * instantes con un rango `[inicio, fin)`. El puente está acá y se prueba acá, porque correrlo
 * un día —guardar la medianoche UTC, que en Argentina son las 21 del día anterior— ya pasó
 * en el panel de inventario de Clickatón.
 *
 * Argentina no tiene horario de verano: el desfase es siempre -03:00.
 */

const DESFASE_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

function medianocheArgentina(dia: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) return null;
  const [y, m, d] = dia.split("-").map(Number) as [number, number, number];
  const utc = Date.UTC(y, m - 1, d);
  const fecha = new Date(utc);
  // `Date.UTC` acepta el 30 de febrero y lo corre al 2 de marzo: eso es un error de tipeo.
  if (fecha.getUTCFullYear() !== y || fecha.getUTCMonth() !== m - 1 || fecha.getUTCDate() !== d) {
    return null;
  }
  return new Date(utc + DESFASE_MS);
}

export type RangoDeFechas = { startsAt: Date; endsAt: Date };

/** Del día `desde` al día `hasta`, ambos incluidos, en hora argentina. */
export function rangoArgentino(desde: string, hasta: string): RangoDeFechas | { error: string } {
  const inicio = medianocheArgentina(desde.trim());
  const ultimo = medianocheArgentina(hasta.trim());
  if (!inicio || !ultimo) return { error: "Elegí una fecha de inicio y una de fin válidas." };
  if (ultimo.getTime() < inicio.getTime()) {
    return { error: "La fecha de fin no puede ser anterior a la de inicio." };
  }
  return { startsAt: inicio, endsAt: new Date(ultimo.getTime() + DIA_MS) };
}

/** Si la asignación cuenta en este instante. El fin no está incluido. */
export function estaVigente(b: RangoDeFechas, ahora: Date): boolean {
  return b.startsAt.getTime() <= ahora.getTime() && ahora.getTime() < b.endsAt.getTime();
}

/**
 * El día argentino de un instante, como `AAAA-MM-DD`. Con `esFin`, el instante es un fin
 * exclusivo (la medianoche del día siguiente) y se devuelve el último día incluido.
 */
export function diaArgentino(instante: Date, opciones?: { esFin?: boolean }): string {
  const t = instante.getTime() - DESFASE_MS - (opciones?.esFin ? 1 : 0);
  return new Date(t).toISOString().slice(0, 10);
}

/** `06/10/2026`, para mostrar. */
export function fechaCorta(dia: string): string {
  const [y, m, d] = dia.split("-");
  return `${d}/${m}/${y}`;
}
