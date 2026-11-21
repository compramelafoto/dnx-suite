/**
 * Partes del ZIP de un lote de impresión. Un ZIP lleva hasta 15 pedidos (el mismo tope que
 * `export-print-lote`: la función dura lo que tarda la descarga, máximo cinco minutos); un lote
 * más grande se baja en partes, cada una con su enlace.
 *
 * Sin base de datos, para poder probarlo. Lo usa `zip-del-lote`.
 */

export const PEDIDOS_POR_PARTE = 15;

/** Los pedidos de a 15, en el orden en que vienen. Sin pedidos no hay partes. */
export function partesDelLote(albumOrderIds: number[]): number[][] {
  const partes: number[][] = [];
  for (let i = 0; i < albumOrderIds.length; i += PEDIDOS_POR_PARTE) {
    partes.push(albumOrderIds.slice(i, i + PEDIDOS_POR_PARTE));
  }
  return partes;
}

/** «Lote 4 - parte 2 de 3.zip». `parte` empieza en 1. */
export function nombreDeLaParte(nombreDelLote: string, parte: number, totalDePartes: number): string {
  return `${nombreDelLote} - parte ${parte} de ${totalDePartes}.zip`;
}
