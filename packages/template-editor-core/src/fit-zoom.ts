/** Límites del zoom del lienzo: por debajo no se distingue nada, por encima no cabe la hoja. */
export const MIN_CANVAS_ZOOM = 0.1;
export const MAX_CANVAS_ZOOM = 4;

/**
 * El zoom con el que la hoja entra entera en el área de trabajo.
 *
 * Antes el lienzo se ajustaba solo al ancho, así que una hoja más alta que ancha —un carnet
 * vertical, por ejemplo— entraba a lo ancho y se salía por abajo: había que scrollear para
 * verla completa. Manda el lado más exigente de los dos.
 *
 * Devuelve `null` cuando todavía no se puede calcular: el área sin medir (alto o ancho en
 * cero, como en el primer pintado) o un lienzo sin dimensiones.
 */
export function fitZoom(
  innerWidth: number,
  innerHeight: number,
  canvasWidth: number,
  canvasHeight: number,
): number | null {
  if (!(innerWidth > 0) || !(innerHeight > 0)) return null;
  if (!(canvasWidth > 0) || !(canvasHeight > 0)) return null;
  const raw = Math.min(innerWidth / canvasWidth, innerHeight / canvasHeight);
  return Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, raw));
}
