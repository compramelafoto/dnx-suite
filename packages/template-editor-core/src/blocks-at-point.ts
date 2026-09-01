import type { TemplateV2Block } from "./render-core";

/**
 * Selección por capas cuando hay elementos superpuestos.
 *
 * Con un fondo que ocupa toda la hoja, todo lo demás queda encima de él y el clic siempre
 * agarra lo de arriba. Sin una forma de bajar, un bloque tapado no se puede seleccionar nunca.
 *
 * La convención es la de las herramientas de diseño: el clic normal toma lo de arriba, y con
 * la tecla de capas se va bajando de a uno, volviendo al tope al llegar al fondo.
 */

/** ¿El punto cae dentro del bloque? Coordenadas del lienzo, no de la pantalla. */
function contiene(b: TemplateV2Block, x: number, y: number): boolean {
  const { x: bx, y: by, width, height } = b.layout;
  return x >= bx && x <= bx + width && y >= by && y <= by + height;
}

/**
 * Los bloques bajo el punto, del que está más arriba al que está más abajo.
 *
 * Se saltean los ocultos y los bloqueados: si no se pueden tocar, ofrecerlos en la ronda haría
 * que la tecla pareciera no hacer nada.
 */
export function blocksAtPoint(
  blocks: readonly TemplateV2Block[],
  x: number,
  y: number,
  pageIndex = 0,
): TemplateV2Block[] {
  return blocks
    .filter(
      (b) =>
        (b.pageIndex ?? 0) === pageIndex &&
        b.layout.visible !== false &&
        !b.layout.locked &&
        contiene(b, x, y),
    )
    .sort((a, b) => b.layout.zIndex - a.layout.zIndex);
}

/**
 * El siguiente bloque de la pila, hacia abajo.
 *
 * Devuelve el de más arriba cuando no hay nada seleccionado o cuando lo seleccionado no está
 * bajo el punto: en los dos casos la persona está empezando una ronda nueva.
 *
 * Al llegar al último vuelve al primero. Cortar la ronda dejaría a alguien apretando sin que
 * pase nada, sin saber si llegó al fondo o si la tecla dejó de funcionar.
 */
export function nextBlockInStack(
  enElPunto: readonly TemplateV2Block[],
  seleccionadoId: string | null,
): TemplateV2Block | null {
  if (enElPunto.length === 0) return null;
  const actual = seleccionadoId
    ? enElPunto.findIndex((b) => b.id === seleccionadoId)
    : -1;
  if (actual === -1) return enElPunto[0] ?? null;
  return enElPunto[(actual + 1) % enElPunto.length] ?? null;
}
