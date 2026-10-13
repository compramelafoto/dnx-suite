/**
 * La regla de no repetir premio: quien ganó un premio no puede volver a ganar ESE premio
 * durante los N meses siguientes. Otro premio distinto, sí.
 *
 * Módulo PURO. Lo usa el sellado del padrón, que es el único momento en que se aplica: las
 * exclusiones se congelan junto con la lista, antes de que exista el número de drand, y entran
 * en la huella. Calcularlas en el acto abriría la misma ventana de manipulación que el sellado
 * existe para cerrar.
 */

export type PrizeForKey = {
  commitmentId: string | null;
  partnerId: string | null;
  partnerNameSnapshot: string | null;
  title: string;
};

/**
 * Qué premio es "el mismo" de un sorteo a otro.
 *
 * El de una serie mensual se reconoce por la serie: el título puede corregirse de un mes a
 * otro sin dejar de ser el mismo premio. Uno suelto se reconoce por aliado y título.
 */
export function prizeSeriesKey(p: PrizeForKey): string {
  if (p.commitmentId) return `serie:${p.commitmentId}`;
  const aliado = p.partnerId ? `id:${p.partnerId}` : `nombre:${normalizar(p.partnerNameSnapshot ?? "")}`;
  return `suelto:${aliado}|${normalizar(p.title)}`;
}

function normalizar(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Suma meses de calendario conservando día y hora; si el mes no llega a ese día, el último. */
export function addMonths(d: Date, months: number): Date {
  const total = d.getUTCMonth() + months;
  const anio = d.getUTCFullYear() + Math.floor(total / 12);
  const mes = ((total % 12) + 12) % 12;
  const ultimoDia = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  return new Date(
    Date.UTC(
      anio,
      mes,
      Math.min(d.getUTCDate(), ultimoDia),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds(),
    ),
  );
}

export type PastWin = { memberId: string; prizeKey: string; raffleDrawsAt: Date };

/**
 * De qué premios de este sorteo queda afuera cada socio.
 *
 * Una victoria en un sorteo con acto en `D` bloquea los sorteos cuyo acto es anterior a
 * `D + months`. Se cuenta desde la hora del ACTO, no desde que se resolvió: eso pasa unos
 * segundos después, y esos segundos dejarían al ganador afuera también del sorteo del mes N. Devuelve
 * sólo los socios con alguna exclusión, con los órdenes de premio ascendentes y sin repetir:
 * ese es el formato que entra en la huella.
 */
export function computeExclusions(input: {
  drawsAt: Date;
  months: number;
  prizes: readonly { order: number; key: string }[];
  pastWins: readonly PastWin[];
}): Map<string, number[]> {
  const resultado = new Map<string, number[]>();
  if (input.months <= 0) return resultado;

  const ordenesPorClave = new Map<string, number[]>();
  for (const p of input.prizes) {
    ordenesPorClave.set(p.key, [...(ordenesPorClave.get(p.key) ?? []), p.order]);
  }

  const porSocio = new Map<string, Set<number>>();
  for (const w of input.pastWins) {
    if (w.raffleDrawsAt.getTime() >= input.drawsAt.getTime()) continue;
    if (input.drawsAt.getTime() >= addMonths(w.raffleDrawsAt, input.months).getTime()) continue;
    const ordenes = ordenesPorClave.get(w.prizeKey);
    if (!ordenes) continue;
    const set = porSocio.get(w.memberId) ?? new Set<number>();
    for (const o of ordenes) set.add(o);
    porSocio.set(w.memberId, set);
  }

  for (const [memberId, set] of porSocio) {
    resultado.set(memberId, [...set].sort((a, b) => a - b));
  }
  return resultado;
}
