/**
 * Qué ítems de impresión de un pedido van sueltos cuando el pedido tiene diseños (librito,
 * carpeta escolar).
 *
 * Cada foto del diseño se lleva una unidad: la que se imprime dentro del PDF. Si la familia
 * además pidió una copia de esa misma foto (una 15x21 de la foto de tapa), esa copia sigue
 * yendo suelta. Antes se descartaba todo ítem con una foto del diseño y la copia se perdía.
 *
 * Se descuenta primero de los ítems del producto con plantilla (tamaño «Librito», sin medida),
 * así lo que queda suelto es la copia con su tamaño de verdad.
 */

type ItemDeImpresion = { photoId: number; quantity: number; size?: string | null };

/** «15x21 cm», «10 x 15»: un tamaño de copia. «Librito» o vacío: parte de un diseño. */
function esTamanoDeCopia(size: string | null | undefined): boolean {
  return /\d\s*x\s*\d/i.test(size ?? "");
}

export function copiasFueraDelDiseno<T extends ItemDeImpresion>(
  items: readonly T[],
  fotosDeLosDisenos: readonly number[],
): T[] {
  const pendientes = new Map<number, number>();
  for (const id of fotosDeLosDisenos) pendientes.set(id, (pendientes.get(id) ?? 0) + 1);

  const restante = new Map<T, number>(items.map((it) => [it, Number(it.quantity || 0)]));
  const orden = [...items].sort((a, b) => Number(esTamanoDeCopia(a.size)) - Number(esTamanoDeCopia(b.size)));
  for (const it of orden) {
    const falta = pendientes.get(it.photoId) ?? 0;
    if (falta === 0) continue;
    const usadas = Math.min(falta, restante.get(it) ?? 0);
    restante.set(it, (restante.get(it) ?? 0) - usadas);
    pendientes.set(it.photoId, falta - usadas);
  }

  return items.flatMap((it) => {
    const quedan = restante.get(it) ?? 0;
    if (quedan <= 0) return [];
    return [quedan === Number(it.quantity || 0) ? it : { ...it, quantity: quedan }];
  });
}
