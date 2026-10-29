/**
 * La geometría del probador de cuadros, sin nada de pantalla: qué composiciones hay, dónde cae
 * cada cuadro dentro del conjunto y cómo se pasa de centímetros de la pared a píxeles de la foto.
 *
 * El cliente marca en su foto las cuatro esquinas de algo cuya medida conoce (la pared, una
 * puerta, un mueble). Esa correspondencia —un rectángulo real en cm contra un cuadrilátero en
 * px— define una homografía: la transformación que lleva cualquier punto del plano de la pared
 * a la foto, con la perspectiva de la cámara. Con ella los cuadros salen a escala y con la
 * inclinación correcta aunque la foto esté sacada de costado.
 */

export type Punto = { x: number; y: number };
/** Un rectángulo en cm, con el origen arriba a la izquierda del conjunto. */
export type Rect = { x: number; y: number; w: number; h: number };
/** Matriz 3×3 por filas; el último elemento queda normalizado en 1. */
export type Homografia = readonly number[];

/** Medidas comerciales de cada cuadro en cm (lado corto × lado largo). */
export const MEDIDAS: readonly (readonly [number, number])[] = [
  [20, 30], [30, 40], [40, 50], [50, 70], [60, 90], [70, 100], [80, 120], [100, 150],
];

export const COMPOSICIONES = [
  { id: "individual", label: "Individual" },
  { id: "diptico", label: "Díptico" },
  { id: "diptico-v", label: "Díptico vertical" },
  { id: "triptico", label: "Tríptico" },
  { id: "triptico-c", label: "Tríptico central" },
  { id: "cuatro", label: "Políptico 4" },
  { id: "grilla2", label: "Grilla 2×2" },
  { id: "grilla3", label: "Grilla 3×3" },
  { id: "galeria", label: "Galería" },
] as const;

export type ComposicionId = (typeof COMPOSICIONES)[number]["id"];

/**
 * Los cuadros de una composición, con `w × h` la medida de cada uno y `g` la separación.
 * En el tríptico central los laterales van al 70 % y centrados en alto; en la galería el grande
 * ocupa la medida elegida y los cuatro chicos suman su misma altura.
 */
export function cuadrosDe(id: ComposicionId, w: number, h: number, g: number): Rect[] {
  const r: Rect[] = [];
  const fila = (n: number) => {
    for (let i = 0; i < n; i++) r.push({ x: i * (w + g), y: 0, w, h });
  };
  const grilla = (n: number) => {
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) r.push({ x: i * (w + g), y: j * (h + g), w, h });
  };
  switch (id) {
    case "individual": fila(1); break;
    case "diptico": fila(2); break;
    case "diptico-v": r.push({ x: 0, y: 0, w, h }, { x: 0, y: h + g, w, h }); break;
    case "triptico": fila(3); break;
    case "cuatro": fila(4); break;
    case "triptico-c": {
      const sw = w * 0.7, sh = h * 0.7, oy = (h - sh) / 2;
      r.push({ x: 0, y: oy, w: sw, h: sh }, { x: sw + g, y: 0, w, h }, { x: sw + g + w + g, y: oy, w: sw, h: sh });
      break;
    }
    case "grilla2": grilla(2); break;
    case "grilla3": grilla(3); break;
    case "galeria": {
      const s = (h - g) / 2, sw = (s * w) / h;
      r.push({ x: 0, y: 0, w, h });
      for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) r.push({ x: w + g + i * (sw + g), y: j * (s + g), w: sw, h: s });
      break;
    }
  }
  return r;
}

/** Ancho y alto totales del conjunto. */
export function medidaDelConjunto(cuadros: readonly Rect[]): { w: number; h: number } {
  let w = 0, h = 0;
  for (const c of cuadros) { w = Math.max(w, c.x + c.w); h = Math.max(h, c.y + c.h); }
  return { w, h };
}

/** Resuelve A·x = b por eliminación con pivoteo parcial. `null` si el sistema es singular. */
function resolver(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map((fila, i) => [...fila, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    if (Math.abs(d) < 1e-12) return null;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / d;
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((fila, i) => fila[n] / fila[i]);
}

/**
 * Si los cuatro puntos, en orden, forman un cuadrilátero convexo de verdad: sin esquinas
 * alineadas, sin lados cruzados. Una pared fotografiada siempre lo es; cuando no, es que el
 * cliente arrastró una esquina de más.
 */
export function esConvexo(p: readonly Punto[]): boolean {
  let signo = 0;
  for (let i = 0; i < 4; i++) {
    const a = p[i], b = p[(i + 1) % 4], c = p[(i + 2) % 4];
    const cruz = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cruz) < 1e-6) return false;
    if (signo === 0) signo = Math.sign(cruz);
    else if (Math.sign(cruz) !== signo) return false;
  }
  return true;
}

/**
 * La homografía que lleva los cuatro puntos `origen` a los cuatro `destino`. `null` cuando
 * alguno de los dos no es un cuadrilátero convexo (esquinas alineadas, lados cruzados).
 */
export function homografia(origen: readonly Punto[], destino: readonly Punto[]): Homografia | null {
  if (!esConvexo(origen) || !esConvexo(destino)) return null;
  const A: number[][] = [], b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = origen[i], { x: u, y: v } = destino[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = resolver(A, b);
  return h ? [...h, 1] : null;
}

/** Aplica la homografía. `w` > 0 indica que el punto cae delante de la cámara. */
export function proyectar(H: Homografia, x: number, y: number): Punto & { w: number } {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w, w };
}

/** La inversa de una matriz 3×3 (por adjunta). */
export function invertir(m: Homografia): Homografia {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [
    A / det, -(b * i - c * h) / det, (b * f - c * e) / det,
    B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det,
  ];
}

/**
 * De un punto de la foto (px) a la pared (cm). `null` si el punto queda del otro lado del
 * horizonte de la pared, donde la inversa no tiene sentido físico.
 */
export function aLaPared(Hi: Homografia, p: Punto): Punto | null {
  const w = Hi[6] * p.x + Hi[7] * p.y + Hi[8];
  if (w <= 0) return null;
  return { x: (Hi[0] * p.x + Hi[1] * p.y + Hi[2]) / w, y: (Hi[3] * p.x + Hi[4] * p.y + Hi[5]) / w };
}

/** Las esquinas del rectángulo de referencia, en el orden en que se marcan en la foto. */
export function esquinasDeReferencia(anchoCm: number, altoCm: number): Punto[] {
  return [{ x: 0, y: 0 }, { x: anchoCm, y: 0 }, { x: anchoCm, y: altoCm }, { x: 0, y: altoCm }];
}
