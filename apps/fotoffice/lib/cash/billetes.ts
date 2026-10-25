/**
 * Los billetes que circulan en el mostrador, en pesos (Daniel, 18/10/2026). Módulo PURO.
 *
 * De acá salen los montos sugeridos de "paga con" del mostrador y el contador de billetes del
 * arqueo. Si aparece un billete nuevo, se agrega acá y los dos lo toman.
 */
export const BILLETES_PESOS = [100, 200, 500, 1_000, 2_000, 10_000, 20_000] as const;

export type ConteoBilletes = Partial<Record<number, number>>;

/** El total en centavos de un conteo, más lo suelto (monedas u otro) que se cargue aparte. */
export function totalDelConteoMinor(conteo: ConteoBilletes, sueltoMinor = 0): number {
  let total = sueltoMinor;
  for (const billete of BILLETES_PESOS) {
    const cantidad = conteo[billete] ?? 0;
    if (Number.isFinite(cantidad) && cantidad > 0) total += Math.floor(cantidad) * billete * 100;
  }
  return total;
}
