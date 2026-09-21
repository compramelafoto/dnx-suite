/**
 * Dónde queda cada clase después de mover una. PURA.
 *
 * Vive acá y no junto a las acciones por una razón del framework: un archivo con
 * `"use server"` sólo puede exportar funciones asíncronas, y ésta no lo es ni tiene por qué
 * serlo. El chequeo de tipos no lo detecta — lo detecta el compilador, recién al construir.
 *
 * Devuelve **la lista completa renumerada de 0 a n-1**, no sólo la clase que se movió: es la
 * única forma de garantizar que no queden dos con el mismo número ni huecos en la secuencia.
 * Un destino fuera de rango se acomoda al extremo más cercano en vez de fallar — quien
 * arrastra con el mouse no tiene por qué acertar el índice.
 */
export function calcularNuevoOrden(
  idsActuales: string[],
  idMovido: string,
  destino: number,
): Array<{ id: string; sortOrder: number }> {
  const sinEl = idsActuales.filter((id) => id !== idMovido);
  if (sinEl.length === idsActuales.length) {
    // La clase no estaba en la lista: no se mueve nada, pero se renumera igual.
    return idsActuales.map((id, i) => ({ id, sortOrder: i }));
  }
  const posicion = Math.max(0, Math.min(destino, sinEl.length));
  sinEl.splice(posicion, 0, idMovido);
  return sinEl.map((id, i) => ({ id, sortOrder: i }));
}
