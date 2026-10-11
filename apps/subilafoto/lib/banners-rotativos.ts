/**
 * A quién le toca el pie del teléfono del invitado.
 *
 * El fotógrafo tiene su banner ahí desde siempre. Ahora los proveedores que completaron
 * su ficha —el DJ, el salón, el catering— pueden subir el suyo, y el pie rota entre
 * todos. Es lo que el fotógrafo les ofrece a cambio de que completen la ficha, y hasta
 * ahora lo único que recibían era un renglón al pie del álbum.
 *
 * **El fotógrafo no se diluye.** Con seis proveedores, repartir en partes iguales lo
 * dejaría con un séptimo de su propia pantalla, delante de su propio cliente. Por eso
 * toma uno de cada dos turnos: los proveedores se reparten la otra mitad.
 *
 * Sin proveedores con banner no hay rotación: queda el del fotógrafo fijo. Un pie que
 * "rota" entre una sola cosa parpadea sin motivo.
 */

export type Turno = { tipo: "FOTOGRAFO" } | { tipo: "PROVEEDOR"; indice: number };

export function cualBannerToca(entrada: {
  /** Cuenta hacia arriba sin tope; el resto sale con módulo. */
  vuelta: number;
  cuantosProveedores: number;
}): Turno {
  const cuantos = Math.max(0, Math.floor(entrada.cuantosProveedores));
  if (cuantos === 0) return { tipo: "FOTOGRAFO" };

  // Pares para el fotógrafo, impares para los proveedores: uno de cada dos.
  if (entrada.vuelta % 2 === 0) return { tipo: "FOTOGRAFO" };

  const cual = Math.floor(entrada.vuelta / 2) % cuantos;
  return { tipo: "PROVEEDOR", indice: cual };
}

/**
 * Cuánto se queda cada uno.
 *
 * Más que una foto de la pantalla del salón, porque acá nadie está mirando el pie: lo ve
 * de reojo mientras elige una foto. Menos que eso y no lo registra nadie.
 */
export const CADA_BANNER_MS = 6_000;
