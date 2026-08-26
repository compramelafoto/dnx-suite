import { clampBlockPosition } from "./clamp-block-position";

/** Alineación del rectángulo del bloque (x,y,w,h) respecto del borde del lienzo, en coordenadas del editor. */
export type CanvasQuickAlignment = "left" | "center-x" | "right" | "top" | "center-y" | "bottom";

type LayoutBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Calcula nueva posición (solo ejes que aplica la acción). Pasa por `clampBlockPosition`
 * para coincidir con drag y límites del canvas.
 */
export function alignLayoutToCanvas(
  alignment: CanvasQuickAlignment,
  canvasWidth: number,
  canvasHeight: number,
  layout: LayoutBox
): { x: number; y: number } {
  const { width: w, height: h } = layout;
  let x = layout.x;
  let y = layout.y;

  switch (alignment) {
    case "left":
      x = 0;
      break;
    case "center-x":
      x = (canvasWidth - w) / 2;
      break;
    case "right":
      x = canvasWidth - w;
      break;
    case "top":
      y = 0;
      break;
    case "center-y":
      y = (canvasHeight - h) / 2;
      break;
    case "bottom":
      y = canvasHeight - h;
      break;
    default:
      break;
  }

  return clampBlockPosition(canvasWidth, canvasHeight, x, y, w, h);
}
