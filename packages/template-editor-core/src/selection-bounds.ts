import type { TemplateV2Block } from "./render-core";

/**
 * El rectángulo que envuelve a varios bloques.
 *
 * Es lo que permite mover y alinear un conjunto como si fuera una sola pieza: al arrastrar dos
 * elementos, lo que se centra respecto de las guías es esta caja, no cada bloque por su cuenta.
 * Sin ella, centrar dos cosas juntas es imposible — cada una se centraría sola y quedarían
 * encimadas.
 */

export type SelectionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Devuelve `null` cuando no hay nada que envolver. Un rectángulo de cero por cero mentiría:
 * el llamador tiene que poder distinguir "no hay selección" de "hay algo sin tamaño".
 */
export function selectionBounds(
  blocks: readonly TemplateV2Block[],
  ids: readonly string[],
): SelectionBounds | null {
  const elegidos = blocks.filter((b) => ids.includes(b.id));
  if (elegidos.length === 0) return null;

  let x1 = Infinity;
  let y1 = Infinity;
  let x2 = -Infinity;
  let y2 = -Infinity;

  for (const b of elegidos) {
    x1 = Math.min(x1, b.layout.x);
    y1 = Math.min(y1, b.layout.y);
    x2 = Math.max(x2, b.layout.x + b.layout.width);
    y2 = Math.max(y2, b.layout.y + b.layout.height);
  }

  if (!Number.isFinite(x1) || !Number.isFinite(y1)) return null;
  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
}

/**
 * Dónde está cada bloque dentro de la caja del conjunto.
 *
 * Se calcula una sola vez al empezar a arrastrar. Recalcularlo en cada movimiento acumularía el
 * redondeo del ajuste a guías y los bloques se irían separando de a poco entre ellos.
 */
export function offsetsWithinSelection(
  blocks: readonly TemplateV2Block[],
  ids: readonly string[],
  bounds: SelectionBounds,
): { id: string; dx: number; dy: number }[] {
  return blocks
    .filter((b) => ids.includes(b.id))
    .map((b) => ({
      id: b.id,
      dx: b.layout.x - bounds.x,
      dy: b.layout.y - bounds.y,
    }));
}
