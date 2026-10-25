/**
 * Redondeo del precio para la caja. Módulo PURO, en centavos enteros.
 *
 * Siempre hacia arriba: redondear para abajo le comería margen al negocio en cada producto.
 * Los tramos existen porque un múltiplo de $1.000 tiene sentido en un cuadro de $80.000 y no
 * en una copia de $1.500: con billetes de $100 se puede dar vuelto en lo barato.
 */

export type TramoRedondeo = { desdeMinor: number; multiploMinor: number };

/** < $5.000 → $100; $5.000 a $19.999 → $500; desde $20.000 → $1.000. */
export const TRAMOS_POR_OMISION: TramoRedondeo[] = [
  { desdeMinor: 0, multiploMinor: 10_000 },
  { desdeMinor: 500_000, multiploMinor: 50_000 },
  { desdeMinor: 2_000_000, multiploMinor: 100_000 },
];

export function redondearArriba(minor: number, tramos: readonly TramoRedondeo[]): number {
  let multiplo = tramos[0]?.multiploMinor ?? 1;
  for (const t of tramos) if (minor >= t.desdeMinor) multiplo = t.multiploMinor;
  if (multiplo <= 0) return Math.ceil(minor);
  return Math.ceil(minor / multiplo) * multiplo;
}

export function validarTramos(raw: unknown): { ok: true; tramos: TramoRedondeo[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) return { ok: false, error: "Cargá al menos un tramo de redondeo." };
  const tramos: TramoRedondeo[] = [];
  for (const t of raw) {
    const desde = (t as TramoRedondeo)?.desdeMinor;
    const multiplo = (t as TramoRedondeo)?.multiploMinor;
    if (!Number.isInteger(desde) || !Number.isInteger(multiplo) || desde < 0) return { ok: false, error: "Un tramo de redondeo no se entiende." };
    if (multiplo <= 0) return { ok: false, error: "El múltiplo de redondeo tiene que ser mayor que cero." };
    tramos.push({ desdeMinor: desde, multiploMinor: multiplo });
  }
  if (tramos[0]!.desdeMinor !== 0) return { ok: false, error: "El primer tramo tiene que empezar en $0." };
  for (let i = 1; i < tramos.length; i++) {
    if (tramos[i]!.desdeMinor <= tramos[i - 1]!.desdeMinor) return { ok: false, error: "Los tramos tienen que ir de menor a mayor." };
  }
  return { ok: true, tramos };
}

/** Lo guardado en la base; si no se entiende, los tramos por omisión. */
export function leerTramos(raw: unknown): TramoRedondeo[] {
  const v = validarTramos(raw);
  return v.ok ? v.tramos : TRAMOS_POR_OMISION;
}
