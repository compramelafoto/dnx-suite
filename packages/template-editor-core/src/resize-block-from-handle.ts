/** Resize desde esquina con modificadores tipo Photoshop / Figma (Alt = centro, Shift = proporción). */

export type ResizeCorner = "nw" | "ne" | "sw" | "se";

export type Rect = { x: number; y: number; width: number; height: number };

const MIN = 24;

/** Resize “libre” desde esquina (comportamiento previo del editor). */
export function resizeFromCornerFree(handle: ResizeCorner, start: Rect, deltaX: number, deltaY: number): Rect {
  let x = start.x;
  let y = start.y;
  let width = start.width;
  let height = start.height;

  if (handle === "se") {
    width = Math.max(MIN, start.width + deltaX);
    height = Math.max(MIN, start.height + deltaY);
  } else if (handle === "sw") {
    width = Math.max(MIN, start.width - deltaX);
    height = Math.max(MIN, start.height + deltaY);
    x = start.x + (start.width - width);
  } else if (handle === "ne") {
    width = Math.max(MIN, start.width + deltaX);
    height = Math.max(MIN, start.height - deltaY);
    y = start.y + (start.height - height);
  } else {
    width = Math.max(MIN, start.width - deltaX);
    height = Math.max(MIN, start.height - deltaY);
    x = start.x + (start.width - width);
    y = start.y + (start.height - height);
  }

  return { x, y, width, height };
}

/** Mantiene relación de aspecto ancho/alto del rectángulo inicial. */
function resizeProportional(handle: ResizeCorner, start: Rect, deltaX: number, deltaY: number): Rect {
  const r = start.width / Math.max(1e-9, start.height);

  if (handle === "se") {
    const newW = Math.max(MIN, start.width + deltaX);
    const newH = Math.max(MIN, newW / r);
    return { x: start.x, y: start.y, width: newW, height: newH };
  }
  if (handle === "sw") {
    const newW = Math.max(MIN, start.width - deltaX);
    const newH = Math.max(MIN, newW / r);
    const nx = start.x + start.width - newW;
    return { x: nx, y: start.y, width: newW, height: newH };
  }
  if (handle === "ne") {
    const newW = Math.max(MIN, start.width + deltaX);
    const newH = Math.max(MIN, newW / r);
    const ny = start.y + start.height - newH;
    return { x: start.x, y: ny, width: newW, height: newH };
  }
  const newW = Math.max(MIN, start.width - deltaX);
  const newH = Math.max(MIN, newW / r);
  const nx = start.x + start.width - newW;
  const ny = start.y + start.height - newH;
  return { x: nx, y: ny, width: newW, height: newH };
}

/** Tras un resize, re-centra el rectángulo respecto al centro del rectángulo inicial. */
function anchorCenter(start: Rect, next: Rect): Rect {
  const cx = start.x + start.width / 2;
  const cy = start.y + start.height / 2;
  return {
    width: next.width,
    height: next.height,
    x: cx - next.width / 2,
    y: cy - next.height / 2,
  };
}

export type ResizeModifiers = {
  shift: boolean;
  /** Alt (Windows) / Option (Mac): mismo flag `altKey` en PointerEvent */
  alt: boolean;
};

/**
 * Calcula el nuevo rectángulo al arrastrar un handle de esquina.
 * - Sin modificadores: igual que antes (esquina opuesta implícita).
 * - Shift: proporcional al tamaño inicial.
 * - Alt: el centro del bloque no se mueve (crece/encoge simétrico).
 * - Alt+Shift: ambos.
 */
export function computeResizeRect(
  handle: ResizeCorner,
  start: Rect,
  deltaX: number,
  deltaY: number,
  modifiers: ResizeModifiers
): Rect {
  let next: Rect;
  if (modifiers.shift) {
    next = resizeProportional(handle, start, deltaX, deltaY);
  } else {
    next = resizeFromCornerFree(handle, start, deltaX, deltaY);
  }
  if (modifiers.alt) {
    next = anchorCenter(start, next);
  }
  return next;
}
