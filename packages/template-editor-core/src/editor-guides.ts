/**
 * Guías de diseño, como las de Photoshop: líneas verticales y horizontales que la persona saca
 * arrastrando desde las reglas, mueve y borra. No se imprimen; sirven para alinear y el imán las
 * usa como cualquier otro borde.
 *
 * Se guardan en la meta de la versión (`meta.guides`), junto a los nombres de las hojas: viajan
 * con la plantilla, entran en deshacer/rehacer y no necesitan columnas nuevas. Valen para todas
 * las hojas, que comparten tamaño.
 */
export const TEMPLATE_V2_GUIDES_META_KEY = "guides";

/** Posiciones en px del lienzo: `v` son guías verticales (una x), `h` horizontales (una y). */
export type EditorGuides = { v: number[]; h: number[] };

export type GuideAxis = "v" | "h";

const EMPTY: EditorGuides = { v: [], h: [] };

function cleanList(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((n): n is number => typeof n === "number" && Number.isFinite(n));
}

/** Lee las guías de la meta; cualquier cosa que no sea una lista de números se ignora. */
export function readGuides(meta: Record<string, unknown> | null | undefined): EditorGuides {
  const raw = meta?.[TEMPLATE_V2_GUIDES_META_KEY];
  if (!raw || typeof raw !== "object") return EMPTY;
  const g = raw as Record<string, unknown>;
  return { v: cleanList(g.v), h: cleanList(g.h) };
}

/** Redondea a décimas de px: suficiente precisión y no ensucia la meta con decimales largos. */
const round = (n: number) => Math.round(n * 10) / 10;

export function addGuide(g: EditorGuides, axis: GuideAxis, pos: number): EditorGuides {
  return { ...g, [axis]: [...g[axis], round(pos)] };
}

export function moveGuide(g: EditorGuides, axis: GuideAxis, index: number, pos: number): EditorGuides {
  if (index < 0 || index >= g[axis].length) return g;
  const list = [...g[axis]];
  list[index] = round(pos);
  return { ...g, [axis]: list };
}

export function removeGuide(g: EditorGuides, axis: GuideAxis, index: number): EditorGuides {
  if (index < 0 || index >= g[axis].length) return g;
  return { ...g, [axis]: g[axis].filter((_, i) => i !== index) };
}

/**
 * Una guía soltada fuera de la hoja se descarta, como en Photoshop cuando se la arrastra de
 * vuelta a la regla.
 */
export function isGuideInsideCanvas(axis: GuideAxis, pos: number, canvasWidth: number, canvasHeight: number): boolean {
  const max = axis === "v" ? canvasWidth : canvasHeight;
  return pos >= 0 && pos <= max;
}
