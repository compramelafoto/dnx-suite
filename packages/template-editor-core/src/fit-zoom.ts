/**
 * Zoom que hace entrar el diseño entero en el área visible.
 *
 * Existe porque acercar y alejar de a saltos es incómodo para lo que la gente hace todo el
 * tiempo: volver a ver la pieza completa después de trabajar sobre un detalle. Sin esto hay que
 * apretar "alejar" varias veces y calcular a ojo cuándo parar.
 */

export type FitZoomInput = {
  /** Tamaño del lienzo, en las unidades del editor. */
  canvasWidth: number;
  canvasHeight: number;
  /** Tamaño del área donde se dibuja, en píxeles de pantalla. */
  viewportWidth: number;
  viewportHeight: number;
  /** Aire alrededor de la pieza, en píxeles. Sin esto queda pegada a los bordes. */
  paddingPx?: number;
};

/** Límites del control de zoom. Fuera de esto no se ve nada útil. */
export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

const PADDING_POR_DEFECTO = 48;

/**
 * Devuelve el zoom con el que la pieza entra completa.
 *
 * Nunca amplía por encima de 1: si la pieza es más chica que la ventana se muestra a tamaño
 * real. Estirar un diseño de 85 mm hasta llenar una pantalla de 27 pulgadas da una idea
 * equivocada de cómo se va a ver impreso.
 */
export function fitZoom(input: FitZoomInput): number {
  const { canvasWidth, canvasHeight, viewportWidth, viewportHeight } = input;
  const padding = input.paddingPx ?? PADDING_POR_DEFECTO;

  const utilAncho = viewportWidth - padding * 2;
  const utilAlto = viewportHeight - padding * 2;

  // Medidas imposibles: no se inventa un zoom, se deja el tamaño real.
  if (
    !Number.isFinite(canvasWidth) ||
    !Number.isFinite(canvasHeight) ||
    canvasWidth <= 0 ||
    canvasHeight <= 0 ||
    utilAncho <= 0 ||
    utilAlto <= 0
  ) {
    return 1;
  }

  const escala = Math.min(utilAncho / canvasWidth, utilAlto / canvasHeight);
  return clampZoom(Math.min(escala, 1));
}

export function clampZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}
