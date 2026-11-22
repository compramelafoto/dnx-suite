/**
 * Encuadre de cada foto dentro de su hueco del collage, cuidando las caras.
 *
 * Sin esto, el Designer recorta al centro (`fit: "cover"`): en un hueco angosto o en una
 * franja horizontal eso deja cabezas cortadas. Acá cada foto se recorta ANTES, a la
 * proporción exacta del hueco, con las caras adentro.
 *
 * Las caras salen de `FaceDetection` (Rekognition): cajas en fracciones de la foto
 * ({ left, top, width, height }, de 0 a 1), sobre la foto ya derecha.
 *
 * A diferencia del mosaico escolar (`lib/mosaico/encuadre-de-cara.ts`), acá NO se hace
 * zoom: la historia muestra la escena, no un retrato. Solo se elige qué parte de la foto
 * entra, con el recorte más grande posible.
 */

export type CajaDeCara = { left: number; top: number; width: number; height: number };
export type Recorte = { left: number; top: number; width: number; height: number };

/**
 * Las caras de fondo (público, gente lejos) no mandan: se consideran solo las que miden
 * al menos esta fracción de la cara más grande.
 */
const CARA_RELEVANTE = 0.35;

/** Altura del recorte donde queda el centro de las caras: un poco arriba de la mitad. */
const ALTURA_DE_LAS_CARAS = 0.42;

/** Aire mínimo sobre la cara, en altos de cara: la caja de Rekognition no incluye pelo, gorra ni casco. */
const AIRE_ARRIBA = 0.9;

const acotar = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export function carasValidas(raw: unknown[]): CajaDeCara[] {
  return raw.filter((b): b is CajaDeCara => {
    if (!b || typeof b !== "object") return false;
    const c = b as Record<string, unknown>;
    return [c.left, c.top, c.width, c.height].every((n) => typeof n === "number" && Number.isFinite(n)) &&
      (c.width as number) > 0 &&
      (c.height as number) > 0;
  });
}

/**
 * Calcula el recorte en píxeles de la foto (`imgW`×`imgH`) para un hueco de
 * `huecoW`×`huecoH`. Devuelve `null` si no hay caras: quien llama usa entonces el recorte
 * por zona de interés de `sharp`.
 */
export function encuadrarCaras(input: {
  imgW: number;
  imgH: number;
  huecoW: number;
  huecoH: number;
  caras: CajaDeCara[];
}): Recorte | null {
  const { imgW, imgH } = input;
  const aspecto = input.huecoW / input.huecoH;
  // El recorte más grande con la proporción del hueco.
  const w = imgW / imgH > aspecto ? Math.round(imgH * aspecto) : imgW;
  const h = imgW / imgH > aspecto ? imgH : Math.round(imgW / aspecto);

  if (input.caras.length === 0) return null;
  const mayor = Math.max(...input.caras.map((c) => c.height));
  const relevantes = input.caras.filter((c) => c.height >= mayor * CARA_RELEVANTE);
  const principal = input.caras.find((c) => c.height === mayor)!;

  const px = (c: CajaDeCara) => ({
    x0: c.left * imgW,
    y0: c.top * imgH,
    x1: (c.left + c.width) * imgW,
    y1: (c.top + c.height) * imgH,
  });
  const cajas = relevantes.map(px);
  const union = {
    x0: Math.min(...cajas.map((c) => c.x0)),
    y0: Math.min(...cajas.map((c) => c.y0)),
    x1: Math.max(...cajas.map((c) => c.x1)),
    y1: Math.max(...cajas.map((c) => c.y1)),
  };
  const p = px(principal);
  const altoCara = p.y1 - p.y0;

  // Horizontal: centrar el grupo; si el grupo no entra, centrar la cara principal.
  const cx = union.x1 - union.x0 <= w ? (union.x0 + union.x1) / 2 : (p.x0 + p.x1) / 2;
  const left = acotar(Math.round(cx - w / 2), 0, imgW - w);

  // Vertical: caras un poco arriba de la mitad, sin cortar la cabeza ni el mentón.
  const grupoEntra = union.y1 - union.y0 + altoCara * AIRE_ARRIBA <= h;
  const ref = grupoEntra ? union : p;
  let top = (ref.y0 + ref.y1) / 2 - h * ALTURA_DE_LAS_CARAS;
  top = Math.min(top, ref.y0 - altoCara * AIRE_ARRIBA); // aire sobre la cabeza
  top = Math.max(top, ref.y1 - h); // que entre el mentón
  top = acotar(Math.round(top), 0, imgH - h);

  return { left, top, width: w, height: h };
}

/**
 * Prioriza fotos con caras que se vean: al menos una cara de tamaño razonable y no una
 * multitud de caritas chicas. Devuelve los ids en el orden del álbum.
 */
export function fotosConCarasBuenas(
  fotos: number[],
  carasPorFoto: Map<number, CajaDeCara[]>,
  alturaMinima = 0.07,
): number[] {
  return fotos.filter((id) => {
    const caras = carasPorFoto.get(id) ?? [];
    if (caras.length === 0) return false;
    return Math.max(...caras.map((c) => c.height)) >= alturaMinima;
  });
}
