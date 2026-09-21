/**
 * El orden de las imágenes de portfolio.
 *
 * Todas las funciones devuelven el orden COMPLETO y renumerado desde 0 de
 * forma contigua. Devolver sólo la imagen movida dejaría huecos y empates, y
 * entonces la galería se ordenaría distinto en cada recarga.
 */
export type ImagenOrdenable = { id: string; sortOrder: number };

/** Orden estable: por posición y, ante un empate, por id. */
function ordenadas<T extends ImagenOrdenable>(imagenes: T[]): T[] {
  return [...imagenes].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
  );
}

function renumerar<T extends ImagenOrdenable>(imagenes: T[]): T[] {
  return imagenes.map((img, i) => ({ ...img, sortOrder: i }));
}

export function moverImagen(
  imagenes: ImagenOrdenable[],
  id: string,
  hacia: "arriba" | "abajo",
): ImagenOrdenable[] {
  const lista = ordenadas(imagenes);
  const i = lista.findIndex((img) => img.id === id);
  if (i === -1) return renumerar(lista);

  const destino = hacia === "arriba" ? i - 1 : i + 1;
  if (destino < 0 || destino >= lista.length) return renumerar(lista);

  const copia = [...lista];
  [copia[i], copia[destino]] = [copia[destino]!, copia[i]!];
  return renumerar(copia);
}

export function ordenTrasBorrar(
  imagenes: ImagenOrdenable[],
  idBorrado: string,
): ImagenOrdenable[] {
  return renumerar(ordenadas(imagenes).filter((img) => img.id !== idBorrado));
}

/**
 * Una imagen nueva va al final. Recibe la cantidad que ya hay, no el arreglo:
 * quien la llama tiene un `count()` de la base, no las filas.
 */
export function ordenParaNueva(cuantasHay: number): number {
  return Math.max(0, cuantasHay);
}
