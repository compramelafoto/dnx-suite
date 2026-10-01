/**
 * Cómo se reparte un paquete de descarga en partes.
 *
 * Un casamiento de trescientas fotos son varios gigabytes. Armarlo de una sola vez no
 * entra en el tiempo ni en la memoria de una función, y bajarlo entero por una conexión
 * hogareña se corta a la mitad. Por eso el paquete se entrega en partes.
 *
 * Función pura: el invariante que importa —que ninguna foto quede afuera— se prueba acá.
 */

/** Cuánto pesa como mucho una parte. Dos gigabytes es lo que un navegador baja sin drama. */
export const TAMANO_MAXIMO_DE_PARTE = 2 * 1024 * 1024 * 1024;

/**
 * Cuánto se supone que pesa una foto sin tamaño conocido.
 *
 * `originalBytes` puede ser nulo si la confirmación de la subida falló a mitad. Tratarla
 * como si pesara cero llenaría una parte de fotos que después no entran.
 */
const PESO_SUPUESTO = 4 * 1024 * 1024;

export type FotoParaEmpaquetar = {
  id: string;
  bytes: number | null;
};

export function repartirEnPartes<T extends FotoParaEmpaquetar>(fotos: readonly T[]): T[][] {
  const partes: T[][] = [];
  let actual: T[] = [];
  let acumulado = 0;

  for (const foto of fotos) {
    const peso = foto.bytes && foto.bytes > 0 ? foto.bytes : PESO_SUPUESTO;

    // Se cierra la parte antes de agregar, no después: así una foto grande no deja una
    // parte pasada de tamaño con otras adentro.
    if (actual.length > 0 && acumulado + peso > TAMANO_MAXIMO_DE_PARTE) {
      partes.push(actual);
      actual = [];
      acumulado = 0;
    }

    // Una foto sola más grande que el tope va igual, en su propia parte. Dejarla afuera
    // sería no entregar algo que el cliente pagó.
    actual.push(foto);
    acumulado += peso;
  }

  if (actual.length > 0) partes.push(actual);
  return partes;
}
