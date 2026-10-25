/** Recorte en proporciones de la foto (0–1). Puro: lo usan el navegador, el servidor y el cron. */
export type Recorte = { x: number; y: number; w: number; h: number };

/** El tamaño se gira para acompañar a la foto: una apaisada pide 18x13, no 13x18. */
export function orientarTamano(fotoW: number, fotoH: number, tamW: number, tamH: number): { w: number; h: number } {
  const largo = Math.max(tamW, tamH);
  const corto = Math.min(tamW, tamH);
  if (fotoW > fotoH) return { w: largo, h: corto };
  if (fotoH > fotoW) return { w: corto, h: largo };
  return { w: tamW, h: tamH };
}

export function recorteInicial(fotoW: number, fotoH: number, tamW: number, tamH: number): Recorte {
  const t = orientarTamano(fotoW, fotoH, tamW, tamH);
  const objetivo = t.w / t.h;
  const foto = fotoW / fotoH;
  if (Math.abs(foto - objetivo) < 1e-6) return { x: 0, y: 0, w: 1, h: 1 };
  if (foto > objetivo) {
    const w = (fotoH * objetivo) / fotoW;
    return { x: (1 - w) / 2, y: 0, w, h: 1 };
  }
  const h = fotoW / objetivo / fotoH;
  return { x: 0, y: (1 - h) / 2, w: 1, h };
}

export function coincideProporcion(fotoW: number, fotoH: number, tamW: number, tamH: number, tolerancia = 0.01): boolean {
  const t = orientarTamano(fotoW, fotoH, tamW, tamH);
  return Math.abs(fotoW / fotoH - t.w / t.h) <= tolerancia * (t.w / t.h);
}

/** Puntos por pulgada que da el recorte sobre el lado largo del tamaño. */
export function pppDelRecorte(fotoW: number, fotoH: number, r: Recorte, tamW: number, tamH: number): number {
  const ladoLargoPx = Math.max(r.w * fotoW, r.h * fotoH);
  const ladoLargoPulgadas = Math.max(tamW, tamH) / 2.54;
  return ladoLargoPx / ladoLargoPulgadas;
}

export function recorteValido(r: unknown): r is Recorte {
  if (!r || typeof r !== "object") return false;
  const { x, y, w, h } = r as Record<string, unknown>;
  const nums = [x, y, w, h];
  if (!nums.every((n) => typeof n === "number" && Number.isFinite(n))) return false;
  const [X, Y, W, H] = nums as number[];
  const eps = 1e-6;
  return X >= -eps && Y >= -eps && W > 0.01 && H > 0.01 && X + W <= 1 + eps && Y + H <= 1 + eps;
}

export function recorteEnPixeles(fotoW: number, fotoH: number, r: Recorte) {
  const left = Math.max(0, Math.round(r.x * fotoW));
  const top = Math.max(0, Math.round(r.y * fotoH));
  const width = Math.min(fotoW - left, Math.round(r.w * fotoW));
  const height = Math.min(fotoH - top, Math.round(r.h * fotoH));
  return { left, top, width, height };
}
