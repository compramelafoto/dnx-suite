/**
 * Utilidades puras del listado, compartidas por componentes de servidor y de navegador.
 *
 * `hrefListado`: una dirección sin parámetros hace que el listado vuelva a la última consulta
 * recordada. Cuando lo pedido es justamente "sin filtros" (quitar el último chip, cerrar el panel
 * sin nada más), se manda `limpio=1` para que no reaparezca lo que se acaba de quitar.
 */
export function hrefListado(ruta: string, query: string): string {
  return query ? `${ruta}?${query}` : `${ruta}?limpio=1`;
}

export function numero(n: number): string {
  return n.toLocaleString("es-AR");
}
