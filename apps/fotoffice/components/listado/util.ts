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

/** Parámetros de aviso (`?ok=…` tras guardar un formulario) que no son consulta pero no deben perderse. */
export const PARAMETROS_AVISO = ["ok", "error", "forbidden", "module"] as const;

/**
 * Destino de un redirect del listado (a la última consulta o a una vista guardada) que conserva
 * los avisos de la dirección actual. Una consulta vacía va con `limpio=1`: así el destino siempre
 * tiene consulta y no vuelve a redirigir.
 */
export function destinoConAvisos(ruta: string, query: string, actual: URLSearchParams): string {
  const out = new URLSearchParams(query || "limpio=1");
  for (const k of PARAMETROS_AVISO) for (const v of actual.getAll(k)) out.append(k, v);
  return `${ruta}?${out.toString()}`;
}

export type SeleccionLote = { tipo: "ids"; ids: string[] } | { tipo: "todos"; query: string };

export function armarSeleccion(todos: boolean, ids: Iterable<string>, query: string): SeleccionLote {
  return todos ? { tipo: "todos", query } : { tipo: "ids", ids: Array.from(ids) };
}

/** Identifica una selección sin importar el orden en que se tildaron las filas. */
export function firmaSeleccion(s: SeleccionLote): string {
  return s.tipo === "todos" ? `todos:${s.query}` : `ids:${[...s.ids].sort().join(",")}`;
}
