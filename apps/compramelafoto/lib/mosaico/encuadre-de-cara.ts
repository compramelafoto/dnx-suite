/**
 * El encuadre de la cara de un compañero dentro de su recuadro del mosaico.
 *
 * Usa la misma convención que el reencuadre de las fotos del diseño (`computeCoverCropRect`):
 * la foto cubre el recuadro, el zoom la agranda alrededor del centro y `x`/`y` (-1 a 1) la corren
 * sobre lo que sobra. La cara queda con un 40 % del alto del recuadro y su centro a un 42 % desde
 * arriba, como en una foto carné.
 *
 * Con la detección de caras guardada (fracciones 0–1 de la foto) se encuadra esa cara; sin ella,
 * se supone un plano medio de frente (la cara arriba y al centro).
 */

export type CajaDeCara = { left: number; top: number; width: number; height: number };
export type EncuadreDeCara = { zoom: number; x: number; y: number };

/** La cara típica de un plano medio de frente, cuando no hay detección. */
const CARA_DE_PLANO_MEDIO: CajaDeCara = { left: 0.36, top: 0.14, width: 0.28, height: 0.26 };
const ALTO_DE_LA_CARA = 0.4;
const CENTRO_DE_LA_CARA = 0.42;
const ZOOM_MAXIMO = 4;

const acotar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const redondear = (n: number) => Math.round(n * 1000) / 1000;

export function encuadreDeCara(input: {
  bbox?: CajaDeCara | null;
  /** Ancho ÷ alto de la foto. */
  aspectoFoto: number;
  /** Ancho ÷ alto del recuadro (el 3:4 de la foto carné por defecto). */
  aspectoRecuadro?: number;
}): EncuadreDeCara {
  const cara = input.bbox && input.bbox.width > 0 && input.bbox.height > 0 ? input.bbox : CARA_DE_PLANO_MEDIO;
  const aFoto = input.aspectoFoto > 0 ? input.aspectoFoto : 0.75;
  const aRecuadro = input.aspectoRecuadro && input.aspectoRecuadro > 0 ? input.aspectoRecuadro : 0.75;

  // Lo que se ve de la foto sin zoom, en fracciones de su ancho y su alto.
  const anchoVisible0 = aFoto > aRecuadro ? aRecuadro / aFoto : 1;
  const altoVisible0 = aFoto > aRecuadro ? 1 : aFoto / aRecuadro;

  const zoom = acotar(altoVisible0 / (cara.height / ALTO_DE_LA_CARA), 1, ZOOM_MAXIMO);
  const anchoVisible = anchoVisible0 / zoom;
  const altoVisible = altoVisible0 / zoom;

  const centroX = cara.left + cara.width / 2;
  const centroY = cara.top + cara.height / 2 + (0.5 - CENTRO_DE_LA_CARA) * altoVisible;
  const corrimiento = (centro: number, visible: number) =>
    visible >= 1 ? 0 : acotar(((centro - 0.5) * 2) / (1 - visible), -1, 1);

  return {
    zoom: redondear(zoom),
    x: input.bbox ? redondear(corrimiento(centroX, anchoVisible)) : 0,
    y: redondear(corrimiento(centroY, altoVisible)),
  };
}
