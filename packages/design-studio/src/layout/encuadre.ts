/**
 * Encuadre de una foto dentro de su recuadro: cuánto se agranda y hacia dónde se corre.
 *
 * Es el reencuadre de los diseñadores de fotolibro: el marco queda quieto y la foto se mueve
 * adentro. Sin esto, una foto en un marco más angosto que ella siempre se recortaba por el
 * centro, y una cara pegada al borde quedaba afuera.
 *
 * La cuenta es la misma en pantalla, en la vista previa y en el PDF: lo que se aprueba es lo que
 * se imprime.
 */

/** `zoom` ≥ 1 (1 = la foto apenas cubre el recuadro). `x` e `y` entre -1 y 1; 0 = centrada. */
export type ImageCrop = { zoom: number; x: number; y: number };

export const ZOOM_MAXIMO_ENCUADRE = 4;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

/** Un encuadre válido, o `null` si no hay ninguno o es el neutro (centrado, sin zoom). */
export function normalizarEncuadre(raw: unknown): ImageCrop | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const n = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);
  const crop = {
    zoom: clamp(n(r.zoom, 1), 1, ZOOM_MAXIMO_ENCUADRE),
    x: clamp(n(r.x, 0), -1, 1),
    y: clamp(n(r.y, 0), -1, 1),
  };
  if (crop.zoom === 1 && crop.x === 0 && crop.y === 0) return null;
  return crop;
}

/**
 * Dónde va la foto entera, en coordenadas del recuadro (origen arriba a la izquierda).
 *
 * Primero la foto cubre el recuadro, como `cover`. El zoom la agranda alrededor del centro y
 * `x`/`y` la corren sobre lo que sobra: -1 pega el borde izquierdo (o superior) de la foto al
 * del recuadro, 1 el derecho (o inferior).
 */
export function ubicarFotoEncuadrada(input: {
  anchoRecuadro: number;
  altoRecuadro: number;
  /** Ancho ÷ alto de la foto original. */
  aspectoFoto: number;
  crop: ImageCrop;
}): { x: number; y: number; width: number; height: number } {
  const aspecto = input.aspectoFoto > 0 ? input.aspectoFoto : 1;
  const ancho = Math.max(input.anchoRecuadro, input.altoRecuadro * aspecto) * input.crop.zoom;
  const alto = ancho / aspecto;
  const sobraX = ancho - input.anchoRecuadro;
  const sobraY = alto - input.altoRecuadro;
  return {
    // `|| 0` evita el -0, que da lo mismo al dibujar pero ensucia las comparaciones.
    x: (-sobraX / 2 - (input.crop.x * sobraX) / 2) || 0,
    y: (-sobraY / 2 - (input.crop.y * sobraY) / 2) || 0,
    width: ancho,
    height: alto,
  };
}
