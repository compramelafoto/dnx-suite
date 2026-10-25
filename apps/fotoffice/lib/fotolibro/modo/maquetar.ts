/**
 * Acomodo automático de las fotos de una página, como en los diseñadores de fotolibro: se elige
 * cuántas fotos van y el sistema las ordena con la misma separación entre todas.
 *
 * Cada foto conserva su proporción (no se recorta al acomodar): las fotos se reparten en filas
 * —o en columnas— que llenan el ancho —o el alto— de la página, y el bloque entero se achica si no
 * entra. Así una vertical y dos horizontales quedan prolijas sin que nadie mida nada.
 *
 * Devuelve **todas** las variantes, de la que mejor llena la página a la que peor: la 0 es la que
 * se usa al soltar las fotos, y recorrerlas es lo que hacen las teclas A/Q y S/W.
 */

export type Caja = { x: number; y: number; w: number; h: number };

/** Particiones de `n` elementos, en orden, en grupos contiguos: [[2,1], [1,2], [3], …]. */
function composiciones(n: number): number[][] {
  if (n === 0) return [[]];
  const out: number[][] = [];
  for (let primero = 1; primero <= n; primero++) {
    for (const resto of composiciones(n - primero)) out.push([primero, ...resto]);
  }
  return out;
}

/**
 * Filas justificadas: cada fila llena el ancho disponible y su alto sale de las proporciones.
 * Con `aspectos` = ancho ÷ alto de cada foto, y la caja ya sin márgenes.
 */
function enFilas(aspectos: number[], filas: number[], caja: Caja, sep: number): { marcos: Caja[]; llenado: number } {
  const grupos: number[][] = [];
  let i = 0;
  for (const cant of filas) {
    grupos.push(aspectos.slice(i, i + cant));
    i += cant;
  }
  // Alto total con un ancho de bloque `a`: Σ (a − sep·(m−1)) / Σaspectos + sep·(filas−1). Lineal en `a`.
  const inv = grupos.reduce((s, g) => s + 1 / g.reduce((x, y) => x + y, 0), 0);
  const fijo = grupos.reduce((s, g) => s + (sep * (g.length - 1)) / g.reduce((x, y) => x + y, 0), 0);
  const sepVertical = sep * (grupos.length - 1);
  const anchoQueEntra = (caja.h - sepVertical + fijo) / inv;
  const ancho = Math.min(caja.w, anchoQueEntra);
  if (ancho <= 0) return { marcos: [], llenado: 0 };

  const altos = grupos.map((g) => (ancho - sep * (g.length - 1)) / g.reduce((x, y) => x + y, 0));
  const altoTotal = altos.reduce((x, y) => x + y, 0) + sepVertical;
  const x0 = caja.x + (caja.w - ancho) / 2;
  let y = caja.y + (caja.h - altoTotal) / 2;
  const marcos: Caja[] = [];
  grupos.forEach((g, r) => {
    let x = x0;
    for (const a of g) {
      const w = altos[r]! * a;
      marcos.push({ x, y, w, h: altos[r]! });
      x += w + sep;
    }
    y += altos[r]! + sep;
  });
  const area = marcos.reduce((s, m) => s + m.w * m.h, 0);
  return { marcos, llenado: area / (caja.w * caja.h) };
}

const transponer = (c: Caja): Caja => ({ x: c.y, y: c.x, w: c.h, h: c.w });

/** Clave para descartar variantes repetidas (una sola foto da lo mismo en filas que en columnas). */
const firma = (marcos: Caja[]) => marcos.map((m) => `${Math.round(m.x)},${Math.round(m.y)},${Math.round(m.w)},${Math.round(m.h)}`).join("|");

export const FOTOS_POR_PAGINA_MAX = 9;

/**
 * Todas las formas de acomodar las fotos en la caja, de la que más llena a la que menos.
 * `marcos[i]` es el lugar de la foto `i`.
 */
export function variantesDeAcomodo(aspectos: number[], caja: Caja, sep: number): Caja[][] {
  const n = aspectos.length;
  if (n === 0 || caja.w <= 0 || caja.h <= 0) return [[]];
  if (n > FOTOS_POR_PAGINA_MAX) throw new Error(`Hasta ${FOTOS_POR_PAGINA_MAX} fotos por página.`);

  const candidatas: { marcos: Caja[]; llenado: number }[] = [];
  for (const filas of composiciones(n)) {
    candidatas.push(enFilas(aspectos, filas, caja, sep));
    // Columnas: las mismas cuentas con los ejes cambiados.
    const col = enFilas(aspectos.map((a) => 1 / a), filas, transponer(caja), sep);
    candidatas.push({ marcos: col.marcos.map(transponer), llenado: col.llenado });
  }
  const vistas = new Set<string>();
  return candidatas
    .filter((c) => c.marcos.length === n)
    .sort((a, b) => b.llenado - a.llenado)
    .filter((c) => {
      const f = firma(c.marcos);
      if (vistas.has(f)) return false;
      vistas.add(f);
      return true;
    })
    .map((c) => c.marcos);
}

/** La variante pedida, dando la vuelta si el número se pasa. */
export function acomodar(aspectos: number[], caja: Caja, sep: number, variante: number): Caja[] {
  const todas = variantesDeAcomodo(aspectos, caja, sep);
  const i = ((variante % todas.length) + todas.length) % todas.length;
  return todas[i] ?? [];
}
