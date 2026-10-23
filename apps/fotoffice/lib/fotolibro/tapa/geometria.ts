import type { ModeloTapa } from "./catalogo";

export type Rect = { x: number; y: number; w: number; h: number };

/**
 * Dónde queda cada parte de la tapa en la pieza que se imprime, en mm (origen arriba a la
 * izquierda, la pieza vista desde afuera).
 *
 * - `tapa`: la cara visible del frente (sin la demasía).
 * - `contratapa`, `lomo`: sólo en las tapas que los imprimen.
 * - `dobleces`: las líneas donde se dobla el papel sobre el cartón, para mostrarlas al diseñar.
 */
export type GeometriaTapa = {
  pieza: { ancho: number; alto: number };
  tapa: Rect;
  contratapa: Rect | null;
  lomo: Rect | null;
  /** Lo que sí se ve en el libro terminado, todo junto. */
  visible: Rect;
  dobleces: { x1: number; y1: number; x2: number; y2: number }[];
};

export function geometriaTapa(modelo: ModeloTapa, hojas: number): GeometriaTapa {
  const d = modelo.demasia;
  if (modelo.tipo === "flexible") {
    const { ancho, alto } = modelo.pieza;
    const mitad = ancho / 2;
    return {
      pieza: { ancho, alto },
      contratapa: { x: 0, y: 0, w: mitad, h: alto },
      tapa: { x: mitad, y: 0, w: mitad, h: alto },
      lomo: null,
      visible: { x: 0, y: 0, w: ancho, h: alto },
      dobleces: [{ x1: mitad, y1: 0, x2: mitad, y2: alto }],
    };
  }

  if (modelo.tipo === "frente") {
    const { ancho, alto } = modelo.pieza;
    // El interior (lado del lomo) queda a la izquierda: la tapa vista desde afuera.
    const tapa = { x: d.interior, y: d.arriba, w: ancho - d.interior - d.exterior, h: alto - d.arriba - d.abajo };
    return {
      pieza: { ancho, alto },
      tapa,
      contratapa: null,
      lomo: null,
      visible: tapa,
      dobleces: [
        { x1: 0, y1: tapa.y, x2: ancho, y2: tapa.y },
        { x1: 0, y1: tapa.y + tapa.h, x2: ancho, y2: tapa.y + tapa.h },
        { x1: tapa.x + tapa.w, y1: 0, x2: tapa.x + tapa.w, y2: alto },
        { x1: tapa.x, y1: 0, x2: tapa.x, y2: alto },
      ],
    };
  }

  // Completa: demasía exterior | contratapa | lomo | tapa | demasía exterior.
  const cara = modelo.pieza.ancho;
  const lomoMm = (modelo.lomo?.baseMm ?? 0) + Math.max(0, hojas) * (modelo.lomo?.porHojaMm ?? 0);
  const ancho = d.exterior * 2 + cara * 2 + lomoMm;
  const alto = modelo.pieza.alto + d.arriba + d.abajo;
  const y = d.arriba;
  const h = modelo.pieza.alto;
  const contratapa = { x: d.exterior, y, w: cara, h };
  const lomo = { x: d.exterior + cara, y, w: lomoMm, h };
  const tapa = { x: d.exterior + cara + lomoMm, y, w: cara, h };
  return {
    pieza: { ancho, alto },
    tapa,
    contratapa,
    lomo,
    visible: { x: d.exterior, y, w: cara * 2 + lomoMm, h },
    dobleces: [
      { x1: 0, y1: y, x2: ancho, y2: y },
      { x1: 0, y1: y + h, x2: ancho, y2: y + h },
      { x1: contratapa.x, y1: 0, x2: contratapa.x, y2: alto },
      { x1: lomo.x, y1: 0, x2: lomo.x, y2: alto },
      { x1: tapa.x, y1: 0, x2: tapa.x, y2: alto },
      { x1: tapa.x + cara, y1: 0, x2: tapa.x + cara, y2: alto },
    ],
  };
}
