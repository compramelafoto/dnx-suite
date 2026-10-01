/**
 * Poner, cambiar y sacar las notas de una obra, y poder volver atrás.
 *
 * Calificar de verdad es equivocarse seguido: apretar un número de más, tocar
 * el criterio que no era, querer dejar una foto sin nota para volver después.
 * Todo eso pasa acá, sin base de datos y sin pantalla, para poder probarlo.
 */

export type NotasDeLaObra = Record<string, number>;

/**
 * Una nota puesta sobre el criterio que se indica, no sobre "el activo".
 *
 * El visor tenía el defecto de guardar en el criterio que estaba seleccionado
 * *antes* del clic: al tocar el 7 de un criterio que no era el activo, el 7
 * caía en el otro. La cura es que quien llama diga siempre sobre cuál escribe.
 *
 * Y volver a elegir la misma nota la saca. Sin eso no había forma de dejar un
 * criterio vacío con el mouse una vez puesto.
 */
export function ponerNota(
  notas: NotasDeLaObra,
  criterio: string,
  valor: number,
): NotasDeLaObra {
  if (notas[criterio] === valor) return sacarNota(notas, criterio);
  return { ...notas, [criterio]: valor };
}

/** Saca una sola nota. Lo que no está no se puede sacar, y no es un error. */
export function sacarNota(
  notas: NotasDeLaObra,
  criterio: string,
): NotasDeLaObra {
  if (!(criterio in notas)) return notas;
  const copia = { ...notas };
  delete copia[criterio];
  return copia;
}

/** Deja la obra como si nunca se hubiera tocado. */
export function borrarTodo(): NotasDeLaObra {
  return {};
}

/** Si dos juegos de notas son el mismo, para no guardar ni apilar de más. */
export function sonIguales(a: NotasDeLaObra, b: NotasDeLaObra): boolean {
  const clavesA = Object.keys(a);
  const clavesB = Object.keys(b);
  if (clavesA.length !== clavesB.length) return false;
  return clavesA.every((k) => a[k] === b[k]);
}

/* ---------- volver atrás ---------- */

export type PasoAtras = {
  entryId: string;
  /** Cómo estaba la obra **antes** del cambio. */
  notas: NotasDeLaObra;
};

/** Cuántos pasos se recuerdan. Alcanza para arreglar un desliz, no para viajar. */
export const PASOS_QUE_SE_RECUERDAN = 50;

/**
 * Apila el estado anterior, descartando el más viejo cuando se llena.
 *
 * Se apila lo de antes y no lo de después: deshacer es volver a un estado que
 * ya existió, y así el primer `deshacer` devuelve exactamente lo que había.
 */
export function apilar(pila: PasoAtras[], paso: PasoAtras): PasoAtras[] {
  const nueva = [...pila, paso];
  return nueva.length > PASOS_QUE_SE_RECUERDAN
    ? nueva.slice(nueva.length - PASOS_QUE_SE_RECUERDAN)
    : nueva;
}

/** Saca el último paso. Devuelve `null` cuando no queda nada que deshacer. */
export function desapilar(
  pila: PasoAtras[],
): { paso: PasoAtras; resto: PasoAtras[] } | null {
  const paso = pila[pila.length - 1];
  if (!paso) return null;
  return { paso, resto: pila.slice(0, -1) };
}
