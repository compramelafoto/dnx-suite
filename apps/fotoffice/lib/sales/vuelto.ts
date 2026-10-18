/**
 * El vuelto del mostrador cuando se paga en efectivo. Módulo PURO.
 *
 * Todo en centavos (`minor`), igual que el resto de Ventas.
 */

/** Redondeos con los que la gente suele pagar, en pesos. */
const REDONDEOS_PESOS = [1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000];

/**
 * Montos sugeridos para "paga con": el justo y los redondeos más probables por encima. Para
 * los redondeos grandes también se ofrece el siguiente: con un total de $ 140.000 nadie paga
 * "redondeado a 20.000" (es el mismo número), pero sí con $ 150.000 o $ 200.000. Sin
 * repetidos, de menor a mayor y como mucho cinco, para que entren en una fila de botones.
 */
export function montosSugeridos(totalMinor: number): number[] {
  if (totalMinor <= 0) return [];
  const arriba = new Set<number>();
  for (const pesos of REDONDEOS_PESOS) {
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
