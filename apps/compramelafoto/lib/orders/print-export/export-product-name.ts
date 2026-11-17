/**
 * Nombre de la carpeta de producto en el ZIP de impresión.
 *
 * Antes se tomaba el primer producto del fotógrafo con ese tamaño: el acabado se comparaba
 * distinguiendo mayúsculas ("MATE" del pedido contra "mate" del producto) y nunca coincidía.
 * Con varios productos del mismo tamaño (Foto grupal, Con la seño, Foto impresa) toda foto
 * suelta caía en "Foto grupal".
 *
 * Orden de preferencia:
 * 1. El producto que eligió el cliente, si el pedido lo guardó (pedidos nuevos).
 * 2. El único producto de ese tamaño y acabado.
 * 3. Si hay varios y no se sabe cuál, uno genérico ("Foto impresa") antes que uno con nombre
 *    de toma: es preferible una carpeta genérica que una equivocada.
 */

export type ExportProductRow = { name: string; size: string | null; acabado: string | null };

const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase();

export function esGenerico(name: string): boolean {
  const n = norm(name);
  return n === "foto impresa" || n === "fotos impresas" || n === "impresa" || n === "copia";
}

export function resolveExportProductName(
  rows: ExportProductRow[],
  size: string,
  finish: string,
  chosenName?: string | null
): string {
  if (chosenName && chosenName.trim()) return chosenName.trim();

  const bySize = rows.filter((p) => norm(p.size) === norm(size));
  const exact = bySize.filter((p) => norm(p.acabado) === norm(finish));
  const candidatos = exact.length > 0 ? exact : bySize;

  if (candidatos.length === 1) return candidatos[0].name;
  if (candidatos.length > 1) {
    const generico = candidatos.find((p) => esGenerico(p.name));
    return generico ? generico.name : "Foto Impresa";
  }
  return "Foto Impresa";
}

/** Producto elegido por el cliente, si el pedido lo guardó en `OrderItem.metadata`. */
export function chosenProductNameFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const name = (metadata as Record<string, unknown>).productName;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/**
 * Productos que valen para un pedido: si el álbum tiene productos propios
 * (`PhotographerProduct.albumId`), sólo esos; si no, los generales del fotógrafo.
 * Sin esto, en un álbum con su "Foto impresa" sin acabado aparecían los "15x21 Mate" de otros álbumes.
 */
export function productosDelAlbum<T extends ExportProductRow & { albumId: number | null }>(
  rows: T[],
  albumId: number | null | undefined,
): T[] {
  const propios = albumId != null ? rows.filter((p) => p.albumId === albumId) : [];
  if (propios.length > 0) return propios;
  return rows.filter((p) => p.albumId == null);
}

/**
 * Acabado a mostrar en el ZIP. Varios caminos de compra (canjes, packs) graban "BRILLO" por defecto
 * aunque el fotógrafo no haya cargado acabado: si ninguno de los productos posibles tiene acabado,
 * no se muestra ("Sin acabado" en el resumen) en vez de inventar "Brillo".
 */
export function acabadoParaExportar(
  rows: ExportProductRow[],
  size: string,
  finish: string,
  chosenName?: string | null,
): string {
  const bySize = rows.filter((p) => norm(p.size) === norm(size));
  const byName = chosenName ? bySize.filter((p) => norm(p.name) === norm(chosenName)) : [];
  const candidatos = byName.length > 0 ? byName : bySize;
  if (candidatos.length > 0 && candidatos.every((p) => !norm(p.acabado))) return "";
  return finish;
}
