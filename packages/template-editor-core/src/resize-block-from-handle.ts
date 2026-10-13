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

/** Un punto del rectángulo, girado alrededor de su centro (convención de CSS `rotate()`). */
function rotatedPoint(rect: Rect, px: number, py: number, rad: number): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * Math.cos(rad) - dy * Math.sin(rad), y: cy + dx * Math.sin(rad) + dy * Math.cos(rad) };
}

/** La esquina opuesta a la que se arrastra: la que tiene que quedarse quieta. */
function oppositeCorner(handle: ResizeCorner, r: Rect): { x: number; y: number } {
  return {
    x: handle === "nw" || handle === "sw" ? r.x + r.width : r.x,
    y: handle === "nw" || handle === "ne" ? r.y + r.height : r.y,
  };
}

/**
 * Como `computeResizeRect`, pero para un bloque girado.
 *
 * El bloque se guarda sin girar (x, y, ancho, alto) y se gira alrededor de su centro. Sin tener
 * en cuenta el giro, con una imagen a 90° arrastrar hacia la derecha agrandaba el alto, y la
 * esquina opuesta se corría porque al cambiar el tamaño cambia el centro del giro.
 *
 * Primero el movimiento del mouse se lleva a los ejes del bloque; después se corre el resultado
 * para que la esquina opuesta (o el centro, con Alt) quede en el mismo lugar de la pantalla.
 */
export function computeResizeRectRotated(
  handle: ResizeCorner,
  start: Rect,
  deltaX: number,
  deltaY: number,
  modifiers: ResizeModifiers,
  rotationDeg: number
): Rect {
  const rad = ((Number.isFinite(rotationDeg) ? rotationDeg : 0) * Math.PI) / 180;
  if (Math.abs(rad) < 1e-9) return computeResizeRect(handle, start, deltaX, deltaY, modifiers);
  const localX = deltaX * Math.cos(rad) + deltaY * Math.sin(rad);
  const localY = -deltaX * Math.sin(rad) + deltaY * Math.cos(rad);
  const next = computeResizeRect(handle, start, localX, localY, modifiers);
  if (modifiers.alt) return next;
  const a = oppositeCorner(handle, start);
  const b = oppositeCorner(handle, next);
  const fijo = rotatedPoint(start, a.x, a.y, rad);
  const ahora = rotatedPoint(next, b.x, b.y, rad);
  return { ...next, x: next.x + (fijo.x - ahora.x), y: next.y + (fijo.y - ahora.y) };
}
