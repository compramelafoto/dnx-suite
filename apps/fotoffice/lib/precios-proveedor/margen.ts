import { redondearArriba, type TramoRedondeo } from "./redondeo";

/**
 * Margen sobre el costo. Módulo PURO, en centavos enteros.
 *
 * El precio nuevo sale SIEMPRE del margen guardado y del costo, nunca del precio anterior:
 * si se partiera del precio ya redondeado, el redondeo se acumularía mes a mes.
 */

/** 170 = costo × 2,7. */
export function precioSugeridoMinor(costMinor: number, marginPct: number, tramos: readonly TramoRedondeo[]): number {
  // Se trabaja en centésimas de punto para no arrastrar error de punto flotante.
  const bruto = (costMinor * Math.round((100 + marginPct) * 100)) / 10_000;
  return redondearArriba(Math.round(bruto * 100) / 100, tramos);
}

/** El margen que hoy tiene un precio, a dos decimales. Sin costo (o costo 0) no hay margen. */
export function calibrarMargenPct(priceMinor: number, costMinor: number | null): number | null {
  if (costMinor === null || costMinor <= 0) return null;
  return Math.round((priceMinor / costMinor - 1) * 10_000) / 100;
}
