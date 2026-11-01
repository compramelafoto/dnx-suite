import type { TourPlacement } from "./types";

export type Box = { top: number; left: number; width: number; height: number };
export type Size = { width: number; height: number };

export type BubblePosition = {
  top: number;
  left: number;
  /** Lado de la sección donde quedó el globo; "center" = sin flecha. */
  side: "top" | "bottom" | "left" | "right" | "center";
  /** Distancia de la flecha desde el borde del globo, sobre el eje que corresponde al lado. */
  arrowOffset: number;
};

const ORDER: Array<"right" | "bottom" | "left" | "top"> = ["right", "bottom", "left", "top"];
const ARROW_MARGIN = 20;

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

/**
 * Ubica el globo junto a la sección iluminada sin que se salga de la pantalla.
 * Prueba el lado pedido y después derecha, abajo, izquierda y arriba. Si la sección es tan
 * grande que no queda lugar en ningún lado (una vista 3D a pantalla completa), el globo
 * va al centro de la pantalla, encima de ella.
 */
export function computeBubblePosition(args: {
  target: Box | null;
  bubble: Size;
  viewport: Size;
  preferred?: TourPlacement;
  gap?: number;
  margin?: number;
}): BubblePosition {
  const { target, bubble, viewport } = args;
  const gap = args.gap ?? 14;
  const margin = args.margin ?? 12;

  const centered: BubblePosition = {
    top: clamp((viewport.height - bubble.height) / 2, margin, viewport.height - bubble.height - margin),
    left: clamp((viewport.width - bubble.width) / 2, margin, viewport.width - bubble.width - margin),
    side: "center",
    arrowOffset: 0,
  };
  if (!target || args.preferred === "center") return centered;

  const fits = {
    right: target.left + target.width + gap + bubble.width <= viewport.width - margin,
    left: target.left - gap - bubble.width >= margin,
    bottom: target.top + target.height + gap + bubble.height <= viewport.height - margin,
    top: target.top - gap - bubble.height >= margin,
  };

  const preferred = args.preferred && args.preferred !== "auto" ? args.preferred : null;
  const candidates = preferred ? [preferred, ...ORDER.filter((s) => s !== preferred)] : ORDER;
  const side = candidates.find((s) => fits[s]);
  if (!side) return centered;

  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;

  if (side === "left" || side === "right") {
    const top = clamp(centerY - bubble.height / 2, margin, viewport.height - bubble.height - margin);
    const left = side === "right" ? target.left + target.width + gap : target.left - gap - bubble.width;
    return {
      top,
      left,
      side,
      arrowOffset: clamp(centerY - top, ARROW_MARGIN, bubble.height - ARROW_MARGIN),
    };
  }

  const left = clamp(centerX - bubble.width / 2, margin, viewport.width - bubble.width - margin);
  const top = side === "bottom" ? target.top + target.height + gap : target.top - gap - bubble.height;
  return {
    top,
    left,
    side,
    arrowOffset: clamp(centerX - left, ARROW_MARGIN, bubble.width - ARROW_MARGIN),
  };
}

/** Recorte de la sección iluminada a la pantalla, con su margen. */
export function spotlightBox(target: Box, padding: number, viewport: Size): Box {
  const top = Math.max(target.top - padding, 4);
  const left = Math.max(target.left - padding, 4);
  const bottom = Math.min(target.top + target.height + padding, viewport.height - 4);
  const right = Math.min(target.left + target.width + padding, viewport.width - 4);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

/** La sección entra completa en la pantalla (si no, hay que desplazarse hasta ella). */
export function isFullyVisible(target: Box, viewport: Size): boolean {
  return (
    target.top >= 0 &&
    target.left >= 0 &&
    target.top + target.height <= viewport.height &&
    target.left + target.width <= viewport.width
  );
}

export function sameBox(a: Box | null, b: Box | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    Math.abs(a.top - b.top) < 0.5 &&
    Math.abs(a.left - b.left) < 0.5 &&
    Math.abs(a.width - b.width) < 0.5 &&
    Math.abs(a.height - b.height) < 0.5
  );
}
