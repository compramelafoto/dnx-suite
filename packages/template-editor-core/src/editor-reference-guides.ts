/**
 * Guías de referencia: líneas fijas que marcan la mitad y los cuartos de la hoja, para ubicar
 * el pliegue de un librito abierto y el centro de cada cara (contratapa y tapa, o página
 * izquierda y derecha).
 *
 * No son parte de la plantilla, a diferencia de las guías de diseño (`meta.guides`): son una
 * preferencia de quien diseña, que la recuerda el navegador. Por eso no se guardan, no entran
 * en deshacer y nunca se imprimen: sólo existen en el lienzo del editor. El imán se pega a la
 * mitad y los cuartos de la hoja siempre, aunque estas guías estén ocultas
 * (`canvasDivisionSnapLines`).
 */

/** Cada guía que se puede prender o apagar desde el menú «Guías». */
export type ReferenceGuideKey =
  /** Mitad del ancho: el pliegue de un librito abierto. */
  | "fold"
  /** Mitad del alto. */
  | "halfH"
  /** 25 % y 75 % del ancho: el centro de cada cara de un librito abierto. */
  | "quartersV"
  /** 25 % y 75 % del alto. */
  | "quartersH"
  /** Una crucecita en el centro de cada cara. */
  | "faceCenters";

export type ReferenceGuideSettings = Record<ReferenceGuideKey, boolean>;

export const REFERENCE_GUIDE_KEYS: readonly ReferenceGuideKey[] = [
  "fold",
  "halfH",
  "quartersV",
  "quartersH",
  "faceCenters",
];

export const REFERENCE_GUIDES_ALL_OFF: ReferenceGuideSettings = {
  fold: false,
  halfH: false,
  quartersV: false,
  quartersH: false,
  faceCenters: false,
};

/**
 * Qué se ve la primera vez. En una hoja común, los dos ejes del centro (lo que el editor
 * mostraba siempre). En un librito abierto, sólo el pliegue: la mitad horizontal no dice nada
 * de cómo se dobla.
 */
export function defaultReferenceGuides(isFoldedSpread: boolean): ReferenceGuideSettings {
  return isFoldedSpread
    ? { ...REFERENCE_GUIDES_ALL_OFF, fold: true }
    : { ...REFERENCE_GUIDES_ALL_OFF, fold: true, halfH: true };
}

/**
 * ¿La hoja es un librito abierto (dos caras lado a lado que se doblan al medio)? Lo dicen las
 * plantillas que traen la medida del pliegue (`foldGuideMmFromLeft`) o una guía de diseño
 * puesta en la mitad del ancho.
 */
export function isFoldedSpread(
  meta: Record<string, unknown> | null | undefined,
  canvas: { width: number; height: number }
): boolean {
  if (!meta) return false;
  if (typeof meta.foldGuideMmFromLeft === "number" && Number.isFinite(meta.foldGuideMmFromLeft)) return true;
  const guides = meta.guides as { v?: unknown } | undefined;
  const v = Array.isArray(guides?.v) ? guides.v : [];
  const mid = canvas.width / 2;
  return v.some((n) => typeof n === "number" && Math.abs(n - mid) <= 1);
}

export function anyReferenceGuideOn(s: ReferenceGuideSettings): boolean {
  return REFERENCE_GUIDE_KEYS.some((k) => s[k]);
}

/** «Mostrar / ocultar todas»: si hay alguna prendida las apaga; si no, prende todas. */
export function toggleAllReferenceGuides(s: ReferenceGuideSettings): ReferenceGuideSettings {
  const on = !anyReferenceGuideOn(s);
  return { fold: on, halfH: on, quartersV: on, quartersH: on, faceCenters: on };
}

export type ReferenceGuideLine = { axis: "v" | "h"; pos: number; kind: ReferenceGuideKey };
export type ReferenceGuideCross = { x: number; y: number };

/** Dos posiciones a menos de esto (px del lienzo) son la misma línea. */
const SAME_LINE_PX = 1;

/**
 * Las líneas a dibujar, en px del lienzo. Se salta la que ya está como guía de diseño de la
 * plantilla (el pliegue de los libritos viene así): esa ya se ve y no hace falta otra encima.
 */
export function buildReferenceGuideLines(
  s: ReferenceGuideSettings,
  canvasWidth: number,
  canvasHeight: number,
  templateGuides: { v: number[]; h: number[] } = { v: [], h: [] }
): { lines: ReferenceGuideLine[]; crosses: ReferenceGuideCross[] } {
  const w = canvasWidth;
  const h = canvasHeight;
  const candidates: ReferenceGuideLine[] = [];
  if (s.fold) candidates.push({ axis: "v", pos: w / 2, kind: "fold" });
  if (s.halfH) candidates.push({ axis: "h", pos: h / 2, kind: "halfH" });
  if (s.quartersV) {
    candidates.push({ axis: "v", pos: w / 4, kind: "quartersV" }, { axis: "v", pos: (3 * w) / 4, kind: "quartersV" });
  }
  if (s.quartersH) {
    candidates.push({ axis: "h", pos: h / 4, kind: "quartersH" }, { axis: "h", pos: (3 * h) / 4, kind: "quartersH" });
  }
  const lines: ReferenceGuideLine[] = [];
  for (const c of candidates) {
    const taken = [...templateGuides[c.axis], ...lines.filter((l) => l.axis === c.axis).map((l) => l.pos)];
    if (taken.some((p) => Math.abs(p - c.pos) < SAME_LINE_PX)) continue;
    lines.push(c);
  }
  const crosses: ReferenceGuideCross[] = s.faceCenters
    ? [
        { x: w / 4, y: h / 2 },
        { x: (3 * w) / 4, y: h / 2 },
      ]
    : [];
  return { lines, crosses };
}

/**
 * Lo que suman al imán, en px del lienzo. La mitad de la hoja ya imanta siempre; acá entran los
 * cuartos y, con la crucecita, el centro de cada cara (cuarto del ancho y mitad del alto).
 */
export function referenceGuideSnapLines(
  s: ReferenceGuideSettings,
  canvasWidth: number,
  canvasHeight: number
): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  const add = (list: number[], v: number) => {
    if (!list.some((p) => Math.abs(p - v) < SAME_LINE_PX)) list.push(v);
  };
  if (s.fold) add(xs, canvasWidth / 2);
  if (s.halfH) add(ys, canvasHeight / 2);
  if (s.quartersV || s.faceCenters) {
    add(xs, canvasWidth / 4);
    add(xs, (3 * canvasWidth) / 4);
  }
  if (s.faceCenters) add(ys, canvasHeight / 2);
  if (s.quartersH) {
    add(ys, canvasHeight / 4);
    add(ys, (3 * canvasHeight) / 4);
  }
  return { xs, ys };
}

/**
 * Las divisiones de la hoja que imantan siempre, se vean o no las guías de referencia: el 25 %,
 * la mitad y el 75 % del ancho y del alto. Ahí caen el pliegue, el centro de cada cara de un
 * librito abierto (cuarto del ancho y mitad del alto) y los cuartos de una hoja común.
 */
export function canvasDivisionSnapLines(canvasWidth: number, canvasHeight: number): { xs: number[]; ys: number[] } {
  return {
    xs: [canvasWidth / 4, canvasWidth / 2, (3 * canvasWidth) / 4],
    ys: [canvasHeight / 4, canvasHeight / 2, (3 * canvasHeight) / 4],
  };
}

/**
 * Todas las líneas extra del imán del editor: las guías de diseño de la plantilla, las
 * divisiones de la hoja (siempre) y las guías de referencia prendidas. Sin repetir.
 */
export function editorSnapGuides(
  templateGuides: { v: number[]; h: number[] },
  s: ReferenceGuideSettings,
  canvasWidth: number,
  canvasHeight: number
): { xs: number[]; ys: number[] } {
  const division = canvasDivisionSnapLines(canvasWidth, canvasHeight);
  const reference = referenceGuideSnapLines(s, canvasWidth, canvasHeight);
  const merge = (...lists: number[][]) => {
    const out: number[] = [];
    for (const v of lists.flat()) if (!out.some((p) => Math.abs(p - v) < SAME_LINE_PX)) out.push(v);
    return out;
  };
  return {
    xs: merge(templateGuides.v, division.xs, reference.xs),
    ys: merge(templateGuides.h, division.ys, reference.ys),
  };
}

/** ¿Es una de las divisiones de la hoja (25 %, 50 %, 75 %)? Esas se marcan en rosa al imantar. */
export function isCanvasDivision(pos: number, canvasSize: number): boolean {
  return [0.25, 0.5, 0.75].some((f) => Math.abs(pos - canvasSize * f) < SAME_LINE_PX);
}

/**
 * Lo que guarda el navegador: una elección para libritos y otra para hojas comunes, así apagar
 * el pliegue en una tarjeta no lo apaga en los libritos.
 */
export type StoredReferenceGuides = {
  spread?: ReferenceGuideSettings;
  sheet?: ReferenceGuideSettings;
};

export const REFERENCE_GUIDES_STORAGE_KEY = "dnx-template-editor:reference-guides:v1";

function readSettings(raw: unknown): ReferenceGuideSettings | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  if (!REFERENCE_GUIDE_KEYS.every((k) => typeof o[k] === "boolean")) return undefined;
  const out = { ...REFERENCE_GUIDES_ALL_OFF };
  for (const k of REFERENCE_GUIDE_KEYS) out[k] = o[k] as boolean;
  return out;
}

/** Lee lo guardado; cualquier cosa rota se ignora y vale lo de fábrica. */
export function parseStoredReferenceGuides(raw: string | null | undefined): StoredReferenceGuides {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return {};
    const out: StoredReferenceGuides = {};
    const spread = readSettings(o.spread);
    const sheet = readSettings(o.sheet);
    if (spread) out.spread = spread;
    if (sheet) out.sheet = sheet;
    return out;
  } catch {
    return {};
  }
}

/** La elección que vale para esta hoja: la guardada para su tipo o la de fábrica. */
export function resolveReferenceGuides(stored: StoredReferenceGuides, isSpread: boolean): ReferenceGuideSettings {
  return (isSpread ? stored.spread : stored.sheet) ?? defaultReferenceGuides(isSpread);
}

export function withReferenceGuides(
  stored: StoredReferenceGuides,
  isSpread: boolean,
  settings: ReferenceGuideSettings
): StoredReferenceGuides {
  return { ...stored, [isSpread ? "spread" : "sheet"]: { ...settings } };
}
