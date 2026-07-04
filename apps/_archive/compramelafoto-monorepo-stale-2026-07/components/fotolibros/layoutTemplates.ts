/**
 * Plantillas de diseño de página (spread) para fotolibros.
 * Cada slot está en coordenadas normalizadas 0–1 respecto al área útil del spread (ancho = 2 páginas, alto = 1 página).
 */

export type LayoutSlot = {
  /** Origen X normalizado (0 = izquierda) */
  nx: number;
  /** Origen Y normalizado (0 = arriba) */
  ny: number;
  /** Ancho normalizado */
  nw: number;
  /** Alto normalizado */
  nh: number;
};

export type LayoutTemplate = {
  id: string;
  name: string;
  slots: LayoutSlot[];
  /** Orientaciones ideales por slot: H=horizontal, V=vertical, S=cuadrado/cualquiera. Si no se define, se infiere del aspecto del slot. */
  slotOrientations?: ("H" | "V" | "S")[];
};

export type Orientation = "H" | "V" | "S";

/** Infiere la orientación ideal de un slot según su aspecto (nw/nh). */
export function getSlotOrientation(slot: LayoutSlot): Orientation {
  const ratio = slot.nw / slot.nh;
  if (ratio > 1.2) return "H";
  if (ratio < 0.83) return "V";
  return "S";
}

/** Puntuación de compatibilidad: 2=perfecto, 1=slot flexible, 0=incompatible */
function scoreSlot(photoO: Orientation, slotO: Orientation): number {
  if (slotO === "S") return 1; // slot cuadrado acepta cualquiera
  return photoO === slotO ? 2 : 0;
}

/** Puntuación total de una plantilla para unas orientaciones de foto. Mayor = mejor encaje. */
export function scoreTemplateMatch(template: LayoutTemplate, orientations: Orientation[]): number {
  if (template.slots.length !== orientations.length) return 0;
  let score = 0;
  for (let i = 0; i < template.slots.length; i++) {
    const slotO = template.slotOrientations?.[i] ?? getSlotOrientation(template.slots[i]);
    score += scoreSlot(orientations[i], slotO);
  }
  return score;
}

/**
 * Devuelve "contain" siempre: la foto se ve completa (ambos lados visibles).
 * Como en Smart Albums: al menos el largo o el corto siempre se ven por completo.
 * Contain garantiza que nunca se recorte ambos lados.
 */
export function getFitModeForMinVisible(
  _photoOrientation: Orientation,
  _slot: LayoutSlot,
  _slotOrientation?: Orientation
): "cover" | "contain" {
  return "contain";
}

/**
 * Devuelve el índice de la plantilla que mejor encaja con las orientaciones dadas.
 * Si orientations está vacío o no hay match, usa la primera plantilla con ese número de slots.
 */
export function getBestTemplateIndexForOrientations(
  templates: LayoutTemplate[],
  slotCount: number,
  orientations: Orientation[]
): number {
  const candidates = templates
    .map((t, idx) => ({ t, idx }))
    .filter(({ t }) => t.slots.length === slotCount);

  if (candidates.length === 0) return -1;
  if (orientations.length === 0 || orientations.length !== slotCount) {
    return candidates[0].idx;
  }

  let bestIdx = candidates[0].idx;
  let bestScore = -1;

  for (const { t, idx } of candidates) {
    let score = 0;
    for (let i = 0; i < t.slots.length && i < orientations.length; i++) {
      const slotO = t.slotOrientations?.[i] ?? getSlotOrientation(t.slots[i]);
      score += scoreSlot(orientations[i], slotO);
    }
    if (score > bestScore) {
      bestScore = score;
      bestIdx = idx;
    }
  }

  return bestIdx;
}

/**
 * Asigna cada imagen al slot que mejor coincida con su orientación (H→H, V→V).
 * Retorna un array de índices: order[i] = índice de la imagen para el slot i.
 */
export function getBestImageOrderForTemplate(
  template: LayoutTemplate,
  orientations: Orientation[]
): number[] {
  const n = template.slots.length;
  if (orientations.length !== n) return Array.from({ length: n }, (_, i) => i);

  const slotOrientations = template.slots.map((s, i) =>
    template.slotOrientations?.[i] ?? getSlotOrientation(s)
  );

  const used = new Set<number>();
  const order: number[] = [];

  for (let slotIdx = 0; slotIdx < n; slotIdx++) {
    const slotO = slotOrientations[slotIdx];
    let bestImgIdx = -1;
    let bestScore = -1;
    for (let imgIdx = 0; imgIdx < n; imgIdx++) {
      if (used.has(imgIdx)) continue;
      const score = scoreSlot(orientations[imgIdx], slotO);
      if (score > bestScore) {
        bestScore = score;
        bestImgIdx = imgIdx;
      }
    }
    if (bestImgIdx >= 0) {
      order.push(bestImgIdx);
      used.add(bestImgIdx);
    }
  }
  return order.length === n ? order : Array.from({ length: n }, (_, i) => i);
}

/** Convierte un slot normalizado a coordenadas reales del canvas (spec + bleed). */
export function slotToRect(
  slot: LayoutSlot,
  contentWidth: number,
  contentHeight: number,
  offsetX: number,
  offsetY: number
) {
  return {
    x: offsetX + slot.nx * contentWidth,
    y: offsetY + slot.ny * contentHeight,
    width: slot.nw * contentWidth,
    height: slot.nh * contentHeight,
  };
}

/** Margen interno entre fotos en la misma plantilla (normalizado). */
const G = 0.01;

const M = 0.04; // Margen típico para plantillas de 1 foto

/** Genera 10+ plantillas para N fotos con variaciones H/V y distribuciones (grid, strip, asimétricas). */
function generateTemplatesForSlotCount(n: number): LayoutTemplate[] {
  const templates: LayoutTemplate[] = [];
  const baseId = `gen-${n}`;

  // Grid N = cols * rows (varias combinaciones)
  const gridFactors: [number, number][] = [];
  for (let cols = 1; cols <= n; cols++) {
    if (n % cols === 0) gridFactors.push([cols, n / cols]);
  }
  gridFactors.slice(0, 4).forEach(([cols, rows], idx) => {
    templates.push({
      id: `${baseId}-grid-${cols}x${rows}`,
      name: `${n} grid ${cols}×${rows}`,
      slots: Array.from({ length: n }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return { nx: c / cols + G / cols, ny: r / rows + G / rows, nw: 1 / cols - G, nh: 1 / rows - G };
      }),
    });
  });

  // Tira horizontal (slots H)
  templates.push({
    id: `${baseId}-strip-h`,
    name: `${n} tira horizontal`,
    slots: Array.from({ length: n }, (_, i) => ({
      nx: 0.02 + (i * 0.96) / n,
      ny: 0.05,
      nw: 0.96 / n - G,
      nh: 0.9,
    })),
    slotOrientations: Array(n).fill("H"),
  });

  // Tira vertical (slots V)
  templates.push({
    id: `${baseId}-strip-v`,
    name: `${n} tira vertical`,
    slots: Array.from({ length: n }, (_, i) => ({
      nx: 0.35,
      ny: 0.02 + (i * 0.96) / n,
      nw: 0.3,
      nh: 0.96 / n - G,
    })),
    slotOrientations: Array(n).fill("V"),
  });

  // 1 grande + (n-1) pequeños
  if (n >= 2) {
    const small = n - 1;
    const smallPerRow = Math.min(small, Math.ceil(Math.sqrt(small)));
    const smallRows = Math.ceil(small / smallPerRow);
    const fw = (0.48 - (smallPerRow - 1) * G) / smallPerRow;
    const fh = (0.96 - (smallRows - 1) * G) / smallRows;
    templates.push({
      id: `${baseId}-1big-rest`,
      name: `${n} 1 grande + rest`,
      slots: [
        { nx: 0.02, ny: 0.02, nw: 0.48 - G, nh: 0.96 },
        ...Array.from({ length: small }, (_, i) => {
          const c = i % smallPerRow;
          const r = Math.floor(i / smallPerRow);
          return { nx: 0.52 + c * (fw + G), ny: 0.02 + r * (fh + G), nw: fw, nh: fh };
        }),
      ],
    });
  }

  // 2 filas: mitad arriba, mitad abajo
  if (n >= 2) {
    const top = Math.ceil(n / 2);
    const bot = n - top;
    templates.push({
      id: `${baseId}-2filas`,
      name: `${n} 2 filas`,
      slots: [
        ...Array.from({ length: top }, (_, i) => ({
          nx: 0.01 + (i * 0.98) / Math.max(1, top),
          ny: 0.01,
          nw: 0.98 / Math.max(1, top) - G,
          nh: 0.48 - G / 2,
        })),
        ...Array.from({ length: bot }, (_, i) => ({
          nx: 0.01 + (i * 0.98) / Math.max(1, bot),
          ny: 0.51 + G / 2,
          nw: 0.98 / Math.max(1, bot) - G,
          nh: 0.48 - G / 2,
        })),
      ],
    });
  }

  // Cuadrícula con márgenes
  const bestCols = Math.ceil(Math.sqrt(n));
  const bestRows = Math.ceil(n / bestCols);
  templates.push({
    id: `${baseId}-grid-margin`,
    name: `${n} cuadrícula con margen`,
    slots: Array.from({ length: n }, (_, i) => {
      const c = i % bestCols;
      const r = Math.floor(i / bestCols);
      const pad = 0.02;
      const cellW = (1 - 2 * pad) / bestCols;
      const cellH = (1 - 2 * pad) / bestRows;
      return { nx: pad + c * cellW, ny: pad + r * cellH, nw: cellW - G, nh: cellH - G };
    }),
  });

  // 3 columnas variación
  if (n >= 6) {
    const cols = 3;
    const rows = Math.ceil(n / cols);
    templates.push({
      id: `${baseId}-3col`,
      name: `${n} en 3 columnas`,
      slots: Array.from({ length: n }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        return { nx: 0.01 + (c * 0.33), ny: 0.01 + (r / rows) * 0.98, nw: 0.32 - G, nh: 0.98 / rows - G };
      }),
    });
  }

  // Rellenar hasta 10+ si hace falta
  while (templates.length < 10) {
    const idx = templates.length;
    const cols = Math.ceil(Math.sqrt(n)) + (idx % 2);
    const rows = Math.ceil(n / cols);
    templates.push({
      id: `${baseId}-var-${idx}`,
      name: `${n} variación ${idx + 1}`,
      slots: Array.from({ length: n }, (_, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        const margin = 0.01 + (idx % 3) * 0.005;
        return {
          nx: margin + (c * (1 - 2 * margin)) / cols,
          ny: margin + (r * (1 - 2 * margin)) / rows,
          nw: (1 - 2 * margin) / cols - G,
          nh: (1 - 2 * margin) / rows - G,
        };
      }),
    });
  }

  return templates;
}

const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // 1 FOTO - Solo las plantillas estilo Match Timeline Order de la referencia
  { id: "1-full-spread", name: "1 foto 100% spread", slots: [{ nx: 0, ny: 0, nw: 1, nh: 1 }], slotOrientations: ["S"] },
  { id: "1-horizontal-full", name: "1 horizontal completo", slots: [{ nx: 0.02, ny: 0.15, nw: 0.96, nh: 0.7 }], slotOrientations: ["H"] },
  { id: "1-vertical-left", name: "1 vertical izq", slots: [{ nx: 0.1, ny: 0.1, nw: 0.25, nh: 0.8 }], slotOrientations: ["V"] },
  { id: "1-horizontal-medium", name: "1 horizontal mediano", slots: [{ nx: 0.15, ny: 0.35, nw: 0.7, nh: 0.3 }], slotOrientations: ["H"] },
  { id: "1-horizontal-wide", name: "1 horizontal ancho", slots: [{ nx: 0.05, ny: 0.25, nw: 0.9, nh: 0.5 }], slotOrientations: ["H"] },
  { id: "1-square-center", name: "1 cuadrado centro", slots: [{ nx: 0.35, ny: 0.25, nw: 0.3, nh: 0.5 }], slotOrientations: ["S"] },
  { id: "1-square-offset-left", name: "1 cuadrado izq", slots: [{ nx: 0.08, ny: 0.3, nw: 0.28, nh: 0.4 }], slotOrientations: ["S"] },
  { id: "1-square-offset-right", name: "1 cuadrado der", slots: [{ nx: 0.64, ny: 0.3, nw: 0.28, nh: 0.4 }], slotOrientations: ["S"] },
  { id: "1-vertical-right", name: "1 vertical der", slots: [{ nx: 0.65, ny: 0.1, nw: 0.25, nh: 0.8 }], slotOrientations: ["V"] },

  // 2 FOTO - Solo las plantillas de la referencia
  { id: "2-cuadrados-lado", name: "2 cuadrados lado a lado", slots: [{ nx: 0.2, ny: 0.25, nw: 0.28, nh: 0.5 }, { nx: 0.52, ny: 0.25, nw: 0.28, nh: 0.5 }], slotOrientations: ["S", "S"] },
  { id: "2-v-apiladas-der", name: "2 verticales apiladas der", slots: [{ nx: 0.52, ny: 0.02, nw: 0.22, nh: 0.46 }, { nx: 0.52, ny: 0.52, nw: 0.15, nh: 0.46 }], slotOrientations: ["H", "V"] },
  { id: "2-cuadrado-grande-chico", name: "2 cuadrado grande izq + chico der", slots: [{ nx: 0.05, ny: 0.2, nw: 0.38, nh: 0.6 }, { nx: 0.55, ny: 0.35, nw: 0.2, nh: 0.3 }], slotOrientations: ["S", "S"] },
  { id: "2-v-apiladas-izq", name: "2 verticales apiladas izq", slots: [{ nx: 0.02, ny: 0.02, nw: 0.2, nh: 0.46 }, { nx: 0.02, ny: 0.52, nw: 0.2, nh: 0.46 }], slotOrientations: ["V", "V"] },
  { id: "2-verticales-lado", name: "2 verticales lado a lado", slots: [{ nx: 0.18, ny: 0.05, nw: 0.32, nh: 0.9 }, { nx: 0.52, ny: 0.05, nw: 0.32, nh: 0.9 }], slotOrientations: ["V", "V"] },
  { id: "2-horizontales-lado", name: "2 horizontales lado a lado", slots: [{ nx: 0.05, ny: 0.35, nw: 0.42, nh: 0.3 }, { nx: 0.52, ny: 0.35, nw: 0.42, nh: 0.3 }], slotOrientations: ["H", "H"] },
  { id: "2-h-grande-v-medio", name: "2 H grande izq + V der", slots: [{ nx: 0.02, ny: 0.05, nw: 0.46, nh: 0.9 }, { nx: 0.52, ny: 0.15, nw: 0.28, nh: 0.7 }], slotOrientations: ["H", "V"] },
  { id: "2-v-grande-h-medio", name: "2 V grande izq + H der", slots: [{ nx: 0.02, ny: 0.02, nw: 0.3, nh: 0.96 }, { nx: 0.52, ny: 0.1, nw: 0.4, nh: 0.28 }], slotOrientations: ["V", "H"] },
  { id: "2-cuadrado-rect", name: "2 cuadrado + rectángulo", slots: [{ nx: 0.15, ny: 0.2, nw: 0.32, nh: 0.6 }, { nx: 0.52, ny: 0.25, nw: 0.38, nh: 0.28 }], slotOrientations: ["S", "H"] },

  // 3 FOTO - Más variantes
  { id: "3-h", name: "3 horizontal", slots: [{ nx: 0, ny: 0, nw: 1 / 3 - G, nh: 1 }, { nx: 1 / 3 + G / 2, ny: 0, nw: 1 / 3 - G, nh: 1 }, { nx: 2 / 3 + G / 2, ny: 0, nw: 1 / 3 - G, nh: 1 }] },
  { id: "3-v", name: "3 vertical", slots: [{ nx: 0, ny: 0, nw: 1, nh: 1 / 3 - G }, { nx: 0, ny: 1 / 3 + G / 2, nw: 1, nh: 1 / 3 - G }, { nx: 0, ny: 2 / 3 + G / 2, nw: 1, nh: 1 / 3 - G }] },
  { id: "3-grid", name: "3 cuadrícula", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 1, nh: 0.5 - G / 2 }] },
  { id: "3-l", name: "3 en L", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }] },
  { id: "3-one-big", name: "3 con 1 grande", slots: [{ nx: 0.02, ny: 0.02, nw: 0.48, nh: 0.96 }, { nx: 0.52, ny: 0.02, nw: 0.46, nh: 0.48 - G / 2 }, { nx: 0.52, ny: 0.5 + G / 2, nw: 0.46, nh: 0.48 - G / 2 }] },
  { id: "3-strip-v", name: "3 tira vertical", slots: [{ nx: 0.35, ny: 0.02, nw: 0.3, nh: 0.32 - G / 2 }, { nx: 0.35, ny: 0.34 + G / 2, nw: 0.3, nh: 0.32 - G / 2 }, { nx: 0.35, ny: 0.66 + G / 2, nw: 0.3, nh: 0.32 - G / 2 }] },
  { id: "3-corners", name: "3 en esquinas", slots: [{ nx: 0.02, ny: 0.02, nw: 0.4, nh: 0.45 }, { nx: 0.58, ny: 0.02, nw: 0.4, nh: 0.45 }, { nx: 0.3, ny: 0.53, nw: 0.4, nh: 0.45 }] },

  // 3 FOTO - Combinaciones H+V (2H+1V, 1H+2V)
  { id: "3-2h-1v-left", name: "2H izq + 1V der", slots: [{ nx: M, ny: 0.1, nw: 0.38, nh: 0.38 }, { nx: M, ny: 0.52, nw: 0.38, nh: 0.38 }, { nx: 0.46, ny: 0.06, nw: 0.26, nh: 0.88 }], slotOrientations: ["H", "H", "V"] },
  { id: "3-2h-1v-right", name: "1V izq + 2H der", slots: [{ nx: M, ny: 0.06, nw: 0.26, nh: 0.88 }, { nx: 0.34, ny: 0.1, nw: 0.38, nh: 0.38 }, { nx: 0.34, ny: 0.52, nw: 0.38, nh: 0.38 }], slotOrientations: ["V", "H", "H"] },
  { id: "3-1h-2v-left", name: "1H izq + 2V der", slots: [{ nx: M, ny: 0.28, nw: 0.4, nh: 0.44 }, { nx: 0.5, ny: 0.04, nw: 0.2, nh: 0.44 }, { nx: 0.5, ny: 0.52, nw: 0.2, nh: 0.44 }], slotOrientations: ["H", "V", "V"] },
  { id: "3-1h-2v-right", name: "2V izq + 1H der", slots: [{ nx: M, ny: 0.04, nw: 0.2, nh: 0.44 }, { nx: M, ny: 0.52, nw: 0.2, nh: 0.44 }, { nx: 0.5, ny: 0.28, nw: 0.4, nh: 0.44 }], slotOrientations: ["V", "V", "H"] },
  { id: "3-hv-top", name: "1H arriba + 2 abajo", slots: [{ nx: 0.05, ny: M, nw: 0.9, nh: 0.35 }, { nx: 0.05, ny: 0.46, nw: 0.44, nh: 0.5 }, { nx: 0.51, ny: 0.46, nw: 0.44, nh: 0.5 }], slotOrientations: ["H", "S", "S"] },
  { id: "3-vh-top", name: "2 arriba + 1H abajo", slots: [{ nx: 0.05, ny: M, nw: 0.44, nh: 0.4 }, { nx: 0.51, ny: M, nw: 0.44, nh: 0.4 }, { nx: 0.05, ny: 0.5, nw: 0.9, nh: 0.45 }], slotOrientations: ["S", "S", "H"] },

  // 4 FOTO - Más variantes
  { id: "4-grid", name: "4 cuadrícula", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }] },
  { id: "4-strip-h", name: "4 tira horizontal", slots: Array.from({ length: 4 }, (_, i) => ({ nx: 0.02 + i * 0.245, ny: 0.25, nw: 0.23 - G, nh: 0.5 })) },
  { id: "4-strip-v", name: "4 tira vertical", slots: Array.from({ length: 4 }, (_, i) => ({ nx: 0.35, ny: 0.02 + i * 0.245, nw: 0.3, nh: 0.23 - G })) },
  { id: "4-asymmetric", name: "4 asimétrico", slots: [{ nx: 0.02, ny: 0.02, nw: 0.58, nh: 0.48 - G / 2 }, { nx: 0.62, ny: 0.02, nw: 0.36, nh: 0.48 - G / 2 }, { nx: 0.02, ny: 0.5 + G / 2, nw: 0.36, nh: 0.48 - G / 2 }, { nx: 0.4, ny: 0.5 + G / 2, nw: 0.58, nh: 0.48 - G / 2 }] },
  { id: "4-diamond", name: "4 en rombo", slots: [{ nx: 0.35, ny: 0.02, nw: 0.3, nh: 0.35 }, { nx: 0.65, ny: 0.32, nw: 0.3, nh: 0.35 }, { nx: 0.35, ny: 0.63, nw: 0.3, nh: 0.35 }, { nx: 0.02, ny: 0.32, nw: 0.3, nh: 0.35 }] },
  { id: "1-2-bottom", name: "1 arriba, 2 abajo", slots: [{ nx: 0, ny: 0, nw: 1, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }] },
  { id: "2-1-bottom", name: "2 arriba, 1 abajo", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 1, nh: 0.5 - G / 2 }] },
  { id: "1-left-2", name: "1 izquierda, 2 derecha", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 1 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }] },
  { id: "2-left-1", name: "2 izquierda, 1 derecha", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 1 }] },
  { id: "1-big-4", name: "1 grande + 4", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 1 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.25 - G / 2 }, { nx: 0.5 + G / 2, ny: 0.25 + G / 2, nw: 0.5 - G / 2, nh: 0.25 - G / 2 }, { nx: 0.5 + G / 2, ny: 0.5 + G / 2, nw: 0.5 - G / 2, nh: 0.25 - G / 2 }, { nx: 0.5 + G / 2, ny: 0.75 + G / 2, nw: 0.5 - G / 2, nh: 0.25 - G / 2 }] },
  { id: "5-strip", name: "5 tira horizontal", slots: Array.from({ length: 5 }, (_, i) => ({ nx: (i * (1 + G)) / 5, ny: 0, nw: (1 - 4 * G) / 5, nh: 1 })) },
  { id: "5-grid", name: "5 cuadrícula 2+3", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 0.33 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.33 + G / 2, ny: 0.5 + G / 2, nw: 0.34 - G, nh: 0.5 - G / 2 }, { nx: 0.67 + G / 2, ny: 0.5 + G / 2, nw: 0.33 - G / 2, nh: 0.5 - G / 2 }] },
  { id: "6-grid", name: "6 cuadrícula", slots: Array.from({ length: 6 }, (_, i) => ({ nx: (i % 3) / 3 + G / 2, ny: Math.floor(i / 3) / 2 + G / 2, nw: 1 / 3 - G, nh: 0.5 - G })) },
  { id: "6-strip", name: "6 tira horizontal", slots: Array.from({ length: 6 }, (_, i) => ({ nx: 0.01 + i * (0.98 / 6), ny: 0.05, nw: 0.98 / 6 - G, nh: 0.9 })) },
  { id: "1-left-3v", name: "1 izq, 3 vertical", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 1 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 1 / 3 - G }, { nx: 0.5 + G / 2, ny: 1 / 3 + G / 2, nw: 0.5 - G / 2, nh: 1 / 3 - G }, { nx: 0.5 + G / 2, ny: 2 / 3 + G / 2, nw: 0.5 - G / 2, nh: 1 / 3 - G }] },
  { id: "3-left-1", name: "3 izq, 1 der", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 1 / 3 - G }, { nx: 0, ny: 1 / 3 + G / 2, nw: 0.5 - G / 2, nh: 1 / 3 - G }, { nx: 0, ny: 2 / 3 + G / 2, nw: 0.5 - G / 2, nh: 1 / 3 - G }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 1 }] },
  { id: "2x2-asymmetric", name: "2+2 asimétrico", slots: [{ nx: 0, ny: 0, nw: 0.6 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.6 + G / 2, ny: 0, nw: 0.4 - G / 2, nh: 0.5 - G / 2 }, { nx: 0, ny: 0.5 + G / 2, nw: 0.4 - G / 2, nh: 0.5 - G / 2 }, { nx: 0.4 + G / 2, ny: 0.5 + G / 2, nw: 0.6 - G / 2, nh: 0.5 - G / 2 }] },
  { id: "1-top-3h", name: "1 arriba, 3 abajo", slots: [{ nx: 0, ny: 0, nw: 1, nh: 0.4 - G / 2 }, { nx: 0, ny: 0.4 + G / 2, nw: 1 / 3 - G, nh: 0.6 - G / 2 }, { nx: 1 / 3 + G / 2, ny: 0.4 + G / 2, nw: 1 / 3 - G, nh: 0.6 - G / 2 }, { nx: 2 / 3 + G / 2, ny: 0.4 + G / 2, nw: 1 / 3 - G, nh: 0.6 - G / 2 }] },
  { id: "3h-1-bottom", name: "3 arriba, 1 abajo", slots: [{ nx: 0, ny: 0, nw: 1 / 3 - G, nh: 0.4 - G / 2 }, { nx: 1 / 3 + G / 2, ny: 0, nw: 1 / 3 - G, nh: 0.4 - G / 2 }, { nx: 2 / 3 + G / 2, ny: 0, nw: 1 / 3 - G, nh: 0.4 - G / 2 }, { nx: 0, ny: 0.4 + G / 2, nw: 1, nh: 0.6 - G / 2 }] },
  { id: "7-grid", name: "7 cuadrícula", slots: [{ nx: 0, ny: 0, nw: 0.5 - G / 2, nh: 0.33 - G / 2 }, { nx: 0.5 + G / 2, ny: 0, nw: 0.5 - G / 2, nh: 0.33 - G / 2 }, { nx: 0, ny: 0.33 + G / 2, nw: 0.33 - G / 2, nh: 0.34 - G / 2 }, { nx: 0.33 + G / 2, ny: 0.33 + G / 2, nw: 0.34 - G, nh: 0.34 - G / 2 }, { nx: 0.67 + G / 2, ny: 0.33 + G / 2, nw: 0.33 - G / 2, nh: 0.34 - G / 2 }, { nx: 0, ny: 0.67 + G / 2, nw: 0.5 - G / 2, nh: 0.33 - G / 2 }, { nx: 0.5 + G / 2, ny: 0.67 + G / 2, nw: 0.5 - G / 2, nh: 0.33 - G / 2 }] },
  { id: "8-grid", name: "8 cuadrícula", slots: Array.from({ length: 8 }, (_, i) => ({ nx: (i % 4) / 4 + G / 2, ny: Math.floor(i / 4) / 2 + G / 2, nw: 1 / 4 - G, nh: 0.5 - G })) },
  { id: "9-grid", name: "9 cuadrícula", slots: Array.from({ length: 9 }, (_, i) => ({ nx: (i % 3) / 3 + G / 2, ny: Math.floor(i / 3) / 3 + G / 2, nw: 1 / 3 - G, nh: 1 / 3 - G })) },

  // 4-9 FOTOS: plantillas adicionales para llegar a 10+ por cantidad
  ...generateTemplatesForSlotCount(4),
  ...generateTemplatesForSlotCount(5),
  ...generateTemplatesForSlotCount(6),
  ...generateTemplatesForSlotCount(7),
  ...generateTemplatesForSlotCount(8),
  ...generateTemplatesForSlotCount(9),

  // 10-20 FOTOS: plantillas generadas (10+ variaciones por cantidad)
  ...generateTemplatesForSlotCount(10),
  ...generateTemplatesForSlotCount(11),
  ...generateTemplatesForSlotCount(12),
  ...generateTemplatesForSlotCount(13),
  ...generateTemplatesForSlotCount(14),
  ...generateTemplatesForSlotCount(15),
  ...generateTemplatesForSlotCount(16),
  ...generateTemplatesForSlotCount(17),
  ...generateTemplatesForSlotCount(18),
  ...generateTemplatesForSlotCount(19),
  ...generateTemplatesForSlotCount(20),

  { id: "empty", name: "Vacío", slots: [] },
];

export default LAYOUT_TEMPLATES;
