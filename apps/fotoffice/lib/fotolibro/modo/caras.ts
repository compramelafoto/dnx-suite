/**
 * Encuadre inteligente con las caras de cada foto.
 *
 * Las caras se detectan en el navegador (ver `components/fotolibro/modo/detectar-caras.ts`) y se
 * guardan con la foto, en proporción de la foto (0 a 1). Con eso:
 *
 * - al poner una foto en un marco más angosto o más bajo que ella, se corre para que las caras
 *   queden en el centro del marco en vez de recortarlas por el centro de la foto;
 * - la revisión avisa si una cara queda en el doblez del lomo.
 *
 * El encuadre que hace alguien a mano siempre manda: el automático se marca (`cropAuto`) y sólo
 * ese se recalcula cuando cambia el marco.
 */

export type Cara = { x: number; y: number; w: number; h: number };

/**
 * La misma cuenta que `ubicarFotoEncuadrada` de design-studio (no se importa para no meter el
 * motor de PDF en la pantalla): dónde va la foto entera dentro del marco.
 */
export function ubicarFoto(anchoMarco: number, altoMarco: number, aspectoFoto: number, crop: { zoom: number; x: number; y: number }) {
  const aspecto = aspectoFoto > 0 ? aspectoFoto : 1;
  const ancho = Math.max(anchoMarco, altoMarco * aspecto) * crop.zoom;
  const alto = ancho / aspecto;
  const sobraX = ancho - anchoMarco;
  const sobraY = alto - altoMarco;
  return { x: -sobraX / 2 - (crop.x * sobraX) / 2, y: -sobraY / 2 - (crop.y * sobraY) / 2, width: ancho, height: alto };
}

const clamp = (n: number) => Math.min(1, Math.max(-1, n));

/** El rectángulo que abarca todas las caras (en proporción de la foto). */
export function zonaDeCaras(caras: readonly Cara[]): Cara | null {
  if (!caras.length) return null;
  const x0 = Math.min(...caras.map((c) => c.x));
  const y0 = Math.min(...caras.map((c) => c.y));
  const x1 = Math.max(...caras.map((c) => c.x + c.w));
  const y1 = Math.max(...caras.map((c) => c.y + c.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/**
 * El encuadre que centra las caras en el marco (sin zoom), o null si no hay caras o si quedaría
 * igual que centrado.
 */
export function encuadreParaCaras(caras: readonly Cara[], anchoMarco: number, altoMarco: number, aspectoFoto: number): { zoom: number; x: number; y: number } | null {
  const z = zonaDeCaras(caras);
  if (!z) return null;
  const foto = ubicarFoto(anchoMarco, altoMarco, aspectoFoto, { zoom: 1, x: 0, y: 0 });
  const sobraX = foto.width - anchoMarco;
  const sobraY = foto.height - altoMarco;
  // Centro de las caras en el centro del marco: offset = marco/2 − centro·tamaño = −sobra/2·(1 + c).
  const cx = z.x + z.w / 2;
  // En vertical se apunta un poco más arriba del centro de las caras: deja aire para la cabeza.
  const cy = z.y + z.h * 0.4;
  const x = sobraX > 0.5 ? clamp((-2 * (anchoMarco / 2 - cx * foto.width)) / sobraX - 1) : 0;
  const y = sobraY > 0.5 ? clamp((-2 * (altoMarco / 2 - cy * foto.height)) / sobraY - 1) : 0;
  if (Math.abs(x) < 0.02 && Math.abs(y) < 0.02) return null;
  return { zoom: 1, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
}

/** Las caras de una foto ya puesta, en coordenadas del lienzo. */
export function carasEnLienzo(
  caras: readonly Cara[],
  marco: { x: number; y: number; width: number; height: number },
  aspectoFoto: number,
  crop: { zoom: number; x: number; y: number } | null,
): Cara[] {
  const f = ubicarFoto(marco.width, marco.height, aspectoFoto, crop ?? { zoom: 1, x: 0, y: 0 });
  return caras
    .map((c) => ({ x: marco.x + f.x + c.x * f.width, y: marco.y + f.y + c.y * f.height, w: c.w * f.width, h: c.h * f.height }))
    // Sólo lo que se ve dentro del marco.
    .filter((c) => c.x + c.w > marco.x && c.x < marco.x + marco.width && c.y + c.h > marco.y && c.y < marco.y + marco.height);
}
