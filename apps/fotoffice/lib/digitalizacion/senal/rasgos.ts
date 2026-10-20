/** Los números de un cuadro achicado a 64×36. Puro: lo usa el worker y lo prueban los tests. */

export const ANCHO = 64;
export const ALTO = 36;
const COLS = 8;
const FILAS = 6;

export type Rasgos = {
  /** Luma media 0–255. */
  brillo: number;
  /** Desvío estándar de la luma. */
  desvio: number;
  /** Saturación media 0–1. */
  saturacion: number;
  r: number;
  g: number;
  b: number;
  /** Grilla 8×6 de [r, g, b] promedio: 144 números. */
  huella: number[];
  luma: Float32Array;
};

export function calcularRasgos(rgba: Uint8ClampedArray, ancho = ANCHO, alto = ALTO): Rasgos {
  const n = ancho * alto;
  const luma = new Float32Array(n);
  const celdas = new Float64Array(COLS * FILAS * 3);
  const cuentas = new Uint32Array(COLS * FILAS);
  let sr = 0, sg = 0, sb = 0, sl = 0, ss = 0;
  for (let p = 0; p < n; p++) {
    const r = rgba[p * 4], g = rgba[p * 4 + 1], b = rgba[p * 4 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    luma[p] = l;
    sr += r; sg += g; sb += b; sl += l;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    ss += max === 0 ? 0 : (max - min) / max;
    const x = p % ancho, y = Math.floor(p / ancho);
    const c = Math.min(FILAS - 1, Math.floor((y * FILAS) / alto)) * COLS + Math.min(COLS - 1, Math.floor((x * COLS) / ancho));
    celdas[c * 3] += r; celdas[c * 3 + 1] += g; celdas[c * 3 + 2] += b;
    cuentas[c] += 1;
  }
  const brillo = sl / n;
  let varianza = 0;
  for (let p = 0; p < n; p++) varianza += (luma[p] - brillo) ** 2;
  const huella: number[] = [];
  for (let c = 0; c < COLS * FILAS; c++) {
    const k = cuentas[c] || 1;
    huella.push(celdas[c * 3] / k, celdas[c * 3 + 1] / k, celdas[c * 3 + 2] / k);
  }
  return { brillo, desvio: Math.sqrt(varianza / n), saturacion: ss / n, r: sr / n, g: sg / n, b: sb / n, huella, luma };
}

export function diferenciaMedia(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

/** Correlación de Pearson de la luma de dos cuadros; 0 si alguno es plano. */
export function correlacion(a: Float32Array, b: Float32Array): number {
  const n = a.length;
  let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let cov = 0, va = 0, vb = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma, db = b[i] - mb;
    cov += da * db; va += da * da; vb += db * db;
  }
  if (va < 1e-6 || vb < 1e-6) return 0;
  return cov / Math.sqrt(va * vb);
}

export function distanciaHuella(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return Infinity;
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
}

export function promediarHuellas(hs: readonly number[][]): number[] {
  if (hs.length === 0) return [];
  return hs[0].map((_, i) => hs.reduce((s, h) => s + h[i], 0) / hs.length);
}
