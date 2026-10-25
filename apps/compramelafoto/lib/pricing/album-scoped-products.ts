/**
 * Productos de un solo álbum (`PhotographerProduct.albumId`).
 *
 * Una fotógrafa con dos colegios a precios distintos no puede mostrar la misma lista en los
 * dos: los padres de uno verían los productos y precios del otro. Regla:
 * - si el álbum tiene productos propios, se ofrecen sólo esos;
 * - si no, los generales (sin álbum);
 * - fuera de un álbum (imprimir, tienda del fotógrafo), sólo los generales.
 */

export function productsForAlbum<T extends { albumId?: number | null }>(
  products: T[],
  albumId?: number | null
): T[] {
  const general = products.filter((p) => p.albumId == null);
  if (albumId == null) return general;
  const propios = products.filter((p) => p.albumId === albumId);
  return propios.length > 0 ? propios : general;
}
