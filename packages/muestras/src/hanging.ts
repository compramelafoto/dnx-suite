/**
 * Plano de montaje (etapa 4): paredes con sus obras en orden y la medida de cada marco.
 *
 * Se guarda entero como JSON en `CulturalActivity.hangingPlan` (decisión D8): el editor de la
 * muestra borra y vuelve a crear las obras en cada guardado, así que no hay FK posible. Por eso
 * esta lectura es tolerante: lo que no se entiende se descarta y las obras que ya no están en la
 * muestra se cuentan en `droppedItems`.
 */
export const DEFAULT_CENTER_HEIGHT_CM = 150;
export const DEFAULT_WALL_HEIGHT_CM = 280;
export const MIN_GAP_CM = 5;

export const HANGING_LIMITS = {
  walls: 30,
  wallName: 60,
  wallWidth: [30, 5000],
  wallHeight: [150, 1500],
  frame: [5, 300],
  center: [100, 200],
} as const;

export type HangingItem = { workId: string; frameWidthCm: number; frameHeightCm: number };
export type HangingWall = { id: string; name: string; widthCm: number; heightCm: number | null; items: HangingItem[] };
export type HangingPlan = { version: 1; centerHeightCm: number; walls: HangingWall[] };

export const emptyHangingPlan = (): HangingPlan => ({ version: 1, centerHeightCm: DEFAULT_CENTER_HEIGHT_CM, walls: [] });

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Un número de centímetros, aceptando "152,5". `null` si no es un número. */
function cm(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v.trim().replace(",", ".")) : Number.NaN;
  return Number.isFinite(n) ? r1(n) : null;
}

const objeto = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const WALL_ID = /^[A-Za-z0-9-]{1,40}$/;

export function parseHangingPlan(raw: unknown, workIds: Iterable<string>): { plan: HangingPlan; droppedItems: number } {
  const validas = new Set(workIds);
  const r = objeto(raw);
  const usadas = new Set<string>();
  const ids = new Set<string>();
  let droppedItems = 0;
  const walls: HangingWall[] = [];
  const crudas = Array.isArray(r?.walls) ? (r.walls as unknown[]) : [];
  // Las obras de las paredes que pasan del tope también se cuentan como descartadas.
  for (const w0 of crudas.slice(HANGING_LIMITS.walls)) {
    const items = objeto(w0)?.items;
    if (Array.isArray(items)) droppedItems += items.length;
  }
  crudas.slice(0, HANGING_LIMITS.walls).forEach((w0, i) => {
    const w = objeto(w0);
    if (!w) return;
    const base = typeof w.id === "string" && WALL_ID.test(w.id) ? w.id : `pared-${i + 1}`;
    let id = base;
    // "x-3", "x", "x": la tercera no puede volver a ser "x-3".
    for (let n = i + 1; ids.has(id); n += 1) id = `${base.slice(0, 40 - String(n).length - 1)}-${n}`;
    ids.add(id);
    const items: HangingItem[] = [];
    for (const it0 of Array.isArray(w.items) ? (w.items as unknown[]) : []) {
      const it = objeto(it0);
      const workId = typeof it?.workId === "string" ? it.workId : "";
      if (!it || !validas.has(workId) || usadas.has(workId)) {
        droppedItems += 1;
        continue;
      }
      usadas.add(workId);
      items.push({ workId, frameWidthCm: cm(it.frameWidthCm) ?? 0, frameHeightCm: cm(it.frameHeightCm) ?? 0 });
    }
    const alto = cm(w.heightCm);
    walls.push({
      id,
      name: typeof w.name === "string" ? w.name.replace(/\s+/g, " ").trim().slice(0, HANGING_LIMITS.wallName) : "",
      widthCm: cm(w.widthCm) ?? 0,
      heightCm: alto && alto > 0 ? alto : null,
      items,
    });
  });
  return { plan: { version: 1, centerHeightCm: cm(r?.centerHeightCm) ?? DEFAULT_CENTER_HEIGHT_CM, walls }, droppedItems };
}

const fuera = (n: number, [a, b]: readonly [number, number]) => !(n >= a && n <= b);

/** Lo que hay que corregir antes de guardar. Lista vacía = se puede guardar. */
export function hangingPlanProblems(plan: HangingPlan): string[] {
  const L = HANGING_LIMITS;
  const out: string[] = [];
  if (fuera(plan.centerHeightCm, L.center)) out.push(`La línea de centro tiene que estar entre ${L.center[0]} y ${L.center[1]} cm del piso.`);
  if (plan.walls.length > L.walls) out.push(`Podés cargar hasta ${L.walls} paredes.`);
  plan.walls.forEach((w, i) => {
    const nombre = w.name || `Pared ${i + 1}`;
    if (!w.name) out.push(`La pared ${i + 1} necesita un nombre.`);
    if (fuera(w.widthCm, L.wallWidth)) out.push(`El ancho de "${nombre}" tiene que estar entre ${L.wallWidth[0]} y ${L.wallWidth[1]} cm.`);
    if (w.heightCm != null && fuera(w.heightCm, L.wallHeight)) {
      out.push(`El alto de "${nombre}" tiene que estar entre ${L.wallHeight[0]} y ${L.wallHeight[1]} cm.`);
    }
    w.items.forEach((it, k) => {
      if (fuera(it.frameWidthCm, L.frame) || fuera(it.frameHeightCm, L.frame)) {
        out.push(`Revisá la medida del marco n.º ${k + 1} de "${nombre}": entre ${L.frame[0]} y ${L.frame[1]} cm por lado.`);
      }
    });
  });
  return out;
}

export type HangingPosition = {
  workId: string;
  /** Número de la obra en la pared, de izquierda a derecha, desde 1. */
  number: number;
  /** Del borde izquierdo de la pared al borde izquierdo del marco. */
  leftCm: number;
  /** Del borde izquierdo de la pared al centro del marco: lo que se mide para colgar. */
  centerFromLeftCm: number;
  bottomCm: number;
  topCm: number;
  widthCm: number;
  heightCm: number;
};
export type WallLayout = { positions: HangingPosition[]; gapCm: number; framesCm: number; fits: boolean; warnings: string[] };

/** "150" o "152,5". */
export function formatCm(n: number): string {
  return Number.isInteger(n) ? String(n) : r1(n).toFixed(1).replace(".", ",");
}

/**
 * Posición de cada marco: centros a `centerHeightCm` del piso y el mismo espacio entre obras y
 * contra los bordes: (ancho − suma de marcos) / (obras + 1). Si no entran, se dibujan pegadas
 * desde el borde izquierdo (el plano muestra cuánto se pasan).
 */
export function hangingLayout(wall: HangingWall, centerHeightCm: number): WallLayout {
  const n = wall.items.length;
  const framesCm = r1(wall.items.reduce((s, it) => s + it.frameWidthCm, 0));
  const fits = framesCm <= wall.widthCm;
  const gap = n === 0 ? wall.widthCm : fits ? (wall.widthCm - framesCm) / (n + 1) : 0;
  const warnings: string[] = [];
  if (!fits) warnings.push(`No entran: los marcos suman ${formatCm(framesCm)} cm y la pared mide ${formatCm(wall.widthCm)} cm.`);
  else if (n > 0 && gap < MIN_GAP_CM) warnings.push(`Quedan muy juntas: ${formatCm(r1(gap))} cm entre obras.`);
  let x = gap;
  const positions = wall.items.map((it, i): HangingPosition => {
    const left = x;
    x += it.frameWidthCm + gap;
    const bottom = centerHeightCm - it.frameHeightCm / 2;
    const top = centerHeightCm + it.frameHeightCm / 2;
    if (bottom < 0) warnings.push(`La obra n.º ${i + 1} llega al piso: subí la línea de centro o achicá el marco.`);
    if (wall.heightCm != null && top > wall.heightCm) warnings.push(`La obra n.º ${i + 1} pasa el alto de la pared.`);
    return {
      workId: it.workId, number: i + 1,
      leftCm: r1(left), centerFromLeftCm: r1(left + it.frameWidthCm / 2),
      bottomCm: r1(bottom), topCm: r1(top),
      widthCm: it.frameWidthCm, heightCm: it.frameHeightCm,
    };
  });
  return { positions, gapCm: r1(gap), framesCm, fits, warnings };
}

/** Las obras de la muestra que todavía no están en ninguna pared, en su orden. */
export function unassignedWorks<W extends { id: string }>(plan: HangingPlan, works: readonly W[]): W[] {
  const asignadas = new Set(plan.walls.flatMap((w) => w.items.map((i) => i.workId)));
  return works.filter((w) => !asignadas.has(w.id));
}

/** Id corto para una pared nueva (lo arma el editor en el navegador). */
export function newWallId(random: () => number = Math.random): string {
  return `p-${Math.floor(random() * 36 ** 6).toString(36).padStart(6, "0")}`;
}
