/**
 * Cómo se ubica una foto dentro de un cuadro: qué punto queda al centro, cuánto zoom, cuántos
 * giros de 90° y cuánta inclinación. Es puro y lo usan la pantalla y, más adelante, el servidor
 * que recorta el archivo para el laboratorio: lo que se ve es lo que se imprime.
 *
 * La foto se dibuja girada `incl` grados sobre el cuadro. Para que nunca se vean esquinas vacías,
 * la caja envolvente del cuadro girado tiene que entrar en la foto: como la foto es un rectángulo
 * sin girar, el cuadro girado entra si y sólo si su caja entra. De ahí salen la escala mínima y
 * el rango del centro.
 */

export type Giro90 = 0 | 90 | 180 | 270;

export type Encuadre = {
  /** Punto de la foto (ya girada de a 90°), de 0 a 1, que cae en el centro del cuadro. */
  cx: number;
  cy: number;
  /** Zoom: 1 es "cubrir el cuadro sin inclinar"; nunca menos que `escalaMinima`. */
  escala: number;
  rot90: Giro90;
  /** Inclinación en grados, para enderezar el horizonte. */
  incl: number;
};

type Medida = { w: number; h: number };

export const ENCUADRE_INICIAL: Encuadre = { cx: 0.5, cy: 0.5, escala: 1, rot90: 0, incl: 0 };
export const INCLINACION_MAXIMA = 15;
export const ESCALA_MAXIMA = 8;

export function dimensionesRotadas(foto: Medida, rot90: Giro90): Medida {
  return rot90 === 90 || rot90 === 270 ? { w: foto.h, h: foto.w } : { w: foto.w, h: foto.h };
}

/** cm por píxel con escala 1: la foto apenas cubre el cuadro. */
function escalaBase(rect: Medida, foto: Medida) {
  return Math.max(rect.w / foto.w, rect.h / foto.h);
}

/** Lo que mide la caja del cuadro girado, en cm. */
function cajaGirada(rect: Medida, incl: number) {
  const t = (incl * Math.PI) / 180, c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return { w: rect.w * c + rect.h * s, h: rect.w * s + rect.h * c };
}

export function escalaMinima(rect: Medida, foto: Medida, e: Encuadre): number {
  const f = dimensionesRotadas(foto, e.rot90), caja = cajaGirada(rect, e.incl);
  return Math.max(caja.w / f.w, caja.h / f.h) / escalaBase(rect, f);
}

export function normalizarEncuadre(e: Encuadre, rect: Medida, foto: Medida): Encuadre {
  const incl = Math.max(-INCLINACION_MAXIMA, Math.min(INCLINACION_MAXIMA, e.incl));
  const base = { ...e, incl };
  const min = escalaMinima(rect, foto, base);
  const escala = Math.max(min, Math.min(Math.max(ESCALA_MAXIMA, min), e.escala));
  const f = dimensionesRotadas(foto, e.rot90), s = escalaBase(rect, f) * escala, caja = cajaGirada(rect, incl);
  // Media caja en píxeles de la foto: el centro no puede acercarse al borde más que eso.
  const hx = caja.w / 2 / s / f.w, hy = caja.h / 2 / s / f.h;
  const limitar = (v: number, h: number) => (h >= 0.5 ? 0.5 : Math.max(h, Math.min(1 - h, v)));
  return { ...base, escala, cx: limitar(e.cx, hx), cy: limitar(e.cy, hy) };
}

export function transformacion(e: Encuadre, rect: Medida, foto: Medida) {
  const f = dimensionesRotadas(foto, e.rot90);
  return { s: escalaBase(rect, f) * e.escala, theta: (e.incl * Math.PI) / 180, fx: e.cx * f.w, fy: e.cy * f.h };
}

/** Arrastrar la foto `dx`, `dy` cm dentro del cuadro: el contenido acompaña al dedo. */
export function desplazar(e: Encuadre, dxCm: number, dyCm: number, rect: Medida, foto: Medida): Encuadre {
  const { s, theta } = transformacion(e, rect, foto), f = dimensionesRotadas(foto, e.rot90);
  const c = Math.cos(-theta), sn = Math.sin(-theta);
  const px = (dxCm * c - dyCm * sn) / s, py = (dxCm * sn + dyCm * c) / s;
  return normalizarEncuadre({ ...e, cx: e.cx - px / f.w, cy: e.cy - py / f.h }, rect, foto);
}
