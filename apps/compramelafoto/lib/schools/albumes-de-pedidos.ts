/**
 * Pedidos escolares: los álbumes de los pedidos que se ven, para el filtro «Álbum» y para saber
 * de qué álbum es la regla «¿Quién elige las fotos?» (se guarda por álbum, no por colegio).
 */

export type AlbumDePedido = { id: number; title: string };

/** Álbumes distintos de los pedidos, ordenados por nombre. Los pedidos sin álbum no cuentan. */
export function albumesDeLosPedidos(pedidos: ReadonlyArray<{ album: AlbumDePedido | null }>): AlbumDePedido[] {
  const porId = new Map<number, AlbumDePedido>();
  for (const p of pedidos) {
    if (p.album && !porId.has(p.album.id)) porId.set(p.album.id, { id: p.album.id, title: p.album.title });
  }
  return [...porId.values()].sort((a, b) => a.title.localeCompare(b.title, "es", { numeric: true }));
}

/**
 * El álbum cuya regla se puede cambiar desde la pantalla: sólo con un colegio elegido, y ahí el
 * álbum elegido o, si el colegio tiene uno solo, ese. Con varios y ninguno elegido, ninguno.
 */
export function albumParaLaRegla(
  colegioElegido: boolean,
  albumes: readonly AlbumDePedido[],
  albumElegido: number | null,
): AlbumDePedido | null {
  if (!colegioElegido) return null;
  if (albumElegido != null) return albumes.find((a) => a.id === albumElegido) ?? null;
  return albumes.length === 1 ? albumes[0] : null;
}
