import { z } from "zod";

/**
 * Revelado básico para JPG. Módulo PURO: la MISMA función corre en el navegador (vista previa,
 * 8 bits) y en el servidor (archivo final, 16 bits), así lo que se ve es lo que sale.
 * Cada control va de −50 a +50; `TOPES` es el efecto real con el control a fondo.
 */

export const CLAVES_AJUSTE = [
  "exposicion", "contraste", "luces", "sombras", "blancos", "negros", "temperatura", "tinte", "saturacion", "intensidad",
] as const;
export type ClaveAjuste = (typeof CLAVES_AJUSTE)[number];
export type Ajustes = Record<ClaveAjuste, number>;

export const AJUSTES_NEUTROS: Ajustes = {
  exposicion: 0, contraste: 0, luces: 0, sombras: 0, blancos: 0, negros: 0, temperatura: 0, tinte: 0, saturacion: 0, intensidad: 0,
};

const control = z.number().int().min(-50).max(50);
export const esquemaAjustes = z
  .object({
    exposicion: control, contraste: control, luces: control, sombras: control, blancos: control,
    negros: control, temperatura: control, tinte: control, saturacion: control, intensidad: control,
  })
  .strict();

export const TOPES = {
  /** Pasos de exposición (EV). */
  exposicionEv: 1,
  /** Fuerza de la curva S. */
  contraste: 0.25,
  /** Desplazamiento máximo en su zona (≈30 % de media escala). */
  lucesSombras: 0.15,
  /** Cuánto se mueve el punto blanco o negro. */
  blancosNegros: 0.08,
  /** ≈ ±1500 K. */
  temperatura: 0.08,
  tinte: 0.06,
  saturacion: 0.35,
  intensidad: 0.35,
} as const;

export function esNeutro(a: Ajustes): boolean {
  return CLAVES_AJUSTE.every((k) => a[k] === 0);
}

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lum = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
function suave(a: number, b: number, x: number): number {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
/** Curva S que deja fijos 0, 0,5 y 1. Con |k| ≤ 0,5 es siempre creciente. */
function curvaS(v: number, k: number): number {
  const c = clamp01(v);
  return c + k * (c - 0.5) * 4 * c * (1 - c);
}

/** Un píxel en 0..1. El orden es fijo y es el mismo en la vista previa y en el final. */
export function ajustarPixel(r0: number, g0: number, b0: number, a: Ajustes): [number, number, number] {
  let r = r0, g = g0, b = b0;
  if (a.exposicion !== 0) {
    const f = 2 ** ((a.exposicion / 50) * TOPES.exposicionEv);
    r *= f; g *= f; b *= f;
  }
  if (a.negros !== 0 || a.blancos !== 0) {
    const bp = -(a.negros / 50) * TOPES.blancosNegros;
    const wp = 1 - (a.blancos / 50) * TOPES.blancosNegros;
    const d = wp - bp;
    r = (r - bp) / d; g = (g - bp) / d; b = (b - bp) / d;
  }
  if (a.contraste !== 0) {
    const k = (a.contraste / 50) * TOPES.contraste * 2;
    r = curvaS(r, k); g = curvaS(g, k); b = curvaS(b, k);
  }
  if (a.sombras !== 0 || a.luces !== 0) {
    const L = clamp01(lum(r, g, b));
    const d =
      (a.sombras / 50) * TOPES.lucesSombras * (1 - suave(0, 0.5, L)) +
      (a.luces / 50) * TOPES.lucesSombras * suave(0.5, 1, L);
    r += d; g += d; b += d;
  }
  if (a.temperatura !== 0) {
    const t = (a.temperatura / 50) * TOPES.temperatura;
    r += t; b -= t;
  }
  if (a.tinte !== 0) {
    const m = (a.tinte / 50) * TOPES.tinte;
    g -= m; r += m / 2; b += m / 2;
  }
  if (a.saturacion !== 0) {
    const L = lum(r, g, b);
    const s = 1 + (a.saturacion / 50) * TOPES.saturacion;
    r = L + (r - L) * s; g = L + (g - L) * s; b = L + (b - L) * s;
  }
  if (a.intensidad !== 0) {
    const L = lum(r, g, b);
    const satActual = clamp01(Math.max(r, g, b) - Math.min(r, g, b));
    const piel = r > g && g > b ? 0.5 : 1;
    const f = 1 + (a.intensidad / 50) * TOPES.intensidad * (1 - satActual) * piel;
    r = L + (r - L) * f; g = L + (g - L) * f; b = L + (b - L) * f;
  }
  return [clamp01(r), clamp01(g), clamp01(b)];
}

/** En el lugar. RGBA (canales 4, el alfa no se toca) o RGB (3). 8 o 16 bits. */
export function aplicarAjustes(px: Uint8Array | Uint8ClampedArray | Uint16Array, canales: 3 | 4, a: Ajustes): void {
  if (esNeutro(a)) return;
  const max = px instanceof Uint16Array ? 65535 : 255;
  for (let i = 0; i + 2 < px.length; i += canales) {
    const [r, g, b] = ajustarPixel(px[i]! / max, px[i + 1]! / max, px[i + 2]! / max, a);
    px[i] = Math.round(r * max);
    px[i + 1] = Math.round(g * max);
    px[i + 2] = Math.round(b * max);
  }
}
