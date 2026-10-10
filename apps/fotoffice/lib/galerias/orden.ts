/**
 * Orden natural por nombre de archivo (etapa 7): "IMG_2" antes que "IMG_10", sin distinguir mayúsculas
 * ni minúsculas, y ESTABLE (los nombres iguales conservan el orden en que venían). Módulo PURO.
 */

type Trozo = { numero: boolean; texto: string };

const TROZOS = /(\d+)|(\D+)/g;

function trozos(nombre: string): Trozo[] {
  const salida: Trozo[] = [];
  for (const m of nombre.matchAll(TROZOS)) {
    if (m[1] !== undefined) salida.push({ numero: true, texto: m[1].replace(/^0+(?=\d)/, "") });
    else salida.push({ numero: false, texto: m[2].toLowerCase() });
  }
  return salida;
}

function compararTrozo(a: Trozo, b: Trozo): number {
  if (a.numero && b.numero) {
    // Sin ceros a la izquierda: más dígitos = más grande; si no, comparación de texto = comparación numérica.
    if (a.texto.length !== b.texto.length) return a.texto.length < b.texto.length ? -1 : 1;
    return a.texto < b.texto ? -1 : a.texto > b.texto ? 1 : 0;
  }
  // Un número antes que un texto en la misma posición (como el explorador de archivos).
  if (a.numero !== b.numero) return a.numero ? -1 : 1;
  return a.texto < b.texto ? -1 : a.texto > b.texto ? 1 : 0;
}

/** Compara dos nombres en orden natural. 0 si son iguales salvo mayúsculas o ceros a la izquierda. */
export function compararNombres(a: string, b: string): number {
  const ta = trozos(a);
  const tb = trozos(b);
  const n = Math.min(ta.length, tb.length);
  for (let i = 0; i < n; i++) {
    const c = compararTrozo(ta[i], tb[i]);
    if (c !== 0) return c;
  }
  return ta.length - tb.length;
}

/** Copia ordenada por `fileName` en orden natural. Estable; no modifica la original. */
export function ordenarPorNombre<T extends { fileName: string }>(fotos: readonly T[]): T[] {
  return fotos
    .map((f, i) => ({ f, i }))
    .sort((x, y) => compararNombres(x.f.fileName, y.f.fileName) || x.i - y.i)
    .map((x) => x.f);
}

type FotoOrdenable = { fileName: string; order: number; id: string };

/**
 * Orden de las fotos de una galería: `NOMBRE` = natural por nombre (en lectura, nunca se guarda);
 * `MANUAL` = por `order` y, si empatan (subidas en paralelo), por nombre natural y id.
 */
export function ordenarFotosDeGaleria<T extends FotoOrdenable>(fotos: readonly T[], modo: "NOMBRE" | "MANUAL"): T[] {
  if (modo === "NOMBRE") return ordenarPorNombre(fotos).sort((a, b) => compararNombres(a.fileName, b.fileName) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  return [...fotos].sort((a, b) => a.order - b.order || compararNombres(a.fileName, b.fileName) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
