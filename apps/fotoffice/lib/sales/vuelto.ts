/**
 * El vuelto del mostrador cuando se paga en efectivo. Módulo PURO.
 *
 * Todo en centavos (`minor`), igual que el resto de Ventas.
 */

import { BILLETES_PESOS } from "@/lib/cash/billetes";

/**
 * Montos sugeridos para "paga con": el justo y lo que se puede juntar con los billetes que
 * circulan (`BILLETES_PESOS`): el total redondeado hacia arriba a cada billete, y para los
 * grandes también el siguiente. Con $ 140.000 no sirve "redondeado a 20.000" (es el mismo
 * número), pero sí $ 150.000 o $ 160.000. Sin repetidos, de menor a mayor y como mucho cinco.
 */
export function montosSugeridos(totalMinor: number): number[] {
  if (totalMinor <= 0) return [];
  const arriba = new Set<number>();
  for (const pesos of BILLETES_PESOS) {
    if (pesos < 1_000) continue; // redondear a 100, 200 o 500 da casi el justo: no ayuda
    const paso = pesos * 100;
    const redondeado = Math.ceil(totalMinor / paso) * paso;
    if (redondeado > totalMinor) arriba.add(redondeado);
    if (pesos >= 10_000) arriba.add((Math.floor(totalMinor / paso) + 1) * paso);
  }
  return [totalMinor, ...[...arriba].sort((x, y) => x - y)].slice(0, 5);
}

export type Vuelto =
  | { estado: "sin-dato" }
  | { estado: "falta"; faltaMinor: number }
  | { estado: "ok"; vueltoMinor: number };

/** Cuánto hay que devolver, o cuánto falta si lo que entregó no alcanza. */
export function calcularVuelto(totalMinor: number, recibidoMinor: number | null): Vuelto {
  if (recibidoMinor === null || recibidoMinor <= 0) return { estado: "sin-dato" };
  if (recibidoMinor < totalMinor) return { estado: "falta", faltaMinor: totalMinor - recibidoMinor };
  return { estado: "ok", vueltoMinor: recibidoMinor - totalMinor };
}
