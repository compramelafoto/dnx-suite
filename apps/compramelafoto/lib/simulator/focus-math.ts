/**
 * Geometría de áreas AF y utilidades de adquisición pedagógica.
 */

import type { FocusAreaMode } from "./focus-types";
import {
  MOVING_SUBJECT_ID,
  PEDESTRIAN_SUBJECT_IDS,
  PHOTOGRAPHIC_VEHICLE_SUBJECT_ID,
  VEHICLE_SUBJECT_ID,
  isPhotographicPedestrianId,
} from "./moving-subject-types";

/**
 * Disposición romboidal tipo Canon/Nikon: filas estrechas arriba/abajo,
 * fila central ancha con punto en el centro del visor (0, 0 NDC).
 *
 *        o   o
 *      o   o   o
 *    o   o ● o   o
 *      o   o   o
 *      o   o   o
 */
const FOCUS_DIAMOND_ROW_X: readonly (readonly number[])[] = [
  [-0.3, 0.3],
  [-0.55, 0, 0.55],
  [-0.88, -0.44, 0, 0.44, 0.88],
  [-0.55, 0, 0.55],
  [-0.55, 0, 0.55],
];

const FOCUS_DIAMOND_ROW_Y: readonly number[] = [0.88, 0.44, 0, -0.44, -0.88];

function buildFocusPointNdcTable(): [number, number][] {
  const points: [number, number][] = [];
  for (let row = 0; row < FOCUS_DIAMOND_ROW_X.length; row += 1) {
    const y = FOCUS_DIAMOND_ROW_Y[row];
    for (const x of FOCUS_DIAMOND_ROW_X[row]) {
      points.push([x, y]);
    }
  }
  return points;
}

export const FOCUS_POINT_NDC: readonly [number, number][] = buildFocusPointNdcTable();
export const FOCUS_POINT_COUNT = FOCUS_POINT_NDC.length;

export const FOCUS_POINT_CENTER_INDEX = FOCUS_POINT_NDC.findIndex(
  ([x, y]) => x === 0 && y === 0,
);

/** Punto central del rombo (fila media). */
export const FOCUS_POINT_DEFAULT_INDEX =
  FOCUS_POINT_CENTER_INDEX >= 0 ? FOCUS_POINT_CENTER_INDEX : 7;

export function focusPointIndexToNdc(index: number): [number, number] {
  const i = ((index % FOCUS_POINT_COUNT) + FOCUS_POINT_COUNT) % FOCUS_POINT_COUNT;
  return FOCUS_POINT_NDC[i];
}

function focusPointRowMeta(index: number): { row: number; col: number; rowCount: number } {
  let offset = 0;
  for (let row = 0; row < FOCUS_DIAMOND_ROW_X.length; row += 1) {
    const rowCount = FOCUS_DIAMOND_ROW_X[row].length;
    if (index < offset + rowCount) {
      return { row, col: index - offset, rowCount };
    }
    offset += rowCount;
  }
  return { row: 0, col: 0, rowCount: 1 };
}

export const FOCUS_ZONE_COUNT = 9;

export const FOCUS_WIDE_SUBAREA_COUNT = 3;

/** Grilla 3×3: índice 0 arriba-izquierda → 8 abajo-derecha. */
export function zoneIndexToNdc(index: number): [number, number] {
  const i = ((index % FOCUS_ZONE_COUNT) + FOCUS_ZONE_COUNT) % FOCUS_ZONE_COUNT;
  const col = i % 3;
  const row = Math.floor(i / 3);
  const x = (col - 1) * 0.32;
  const y = (1 - row) * 0.28;
  return [x, y];
}

export function pointAreaLabel(index: number): string {
  const i = ((index % FOCUS_POINT_COUNT) + FOCUS_POINT_COUNT) % FOCUS_POINT_COUNT;
  if (i === FOCUS_POINT_CENTER_INDEX) return "Centro";
  const { row, col, rowCount } = focusPointRowMeta(i);
  const rowLabels = ["Sup.", "C. sup.", "Centro", "C. inf.", "Inf."];
  if (rowCount === 1) return rowLabels[row];
  return `${rowLabels[row]} ${col + 1}`;
}

export function zoneAreaLabel(index: number): string {
  return `Zona ${index + 1}`;
}

export function wideAreaLabel(index: number): string {
  if (index === 0) return "Amplia · Centro";
  if (index === 1) return "Amplia · Izquierda";
  return "Amplia · Derecha";
}

export function areaFeedbackLabel(mode: FocusAreaMode, index: number): string {
  switch (mode) {
    case "POINT":
      return `Área AF: ${pointAreaLabel(index)}`;
    case "ZONE":
      return `Área AF: ${zoneAreaLabel(index)}`;
    case "WIDE":
      return `Área AF: ${wideAreaLabel(index)}`;
  }
}

export function areaHudLabel(mode: FocusAreaMode, index: number): string {
  switch (mode) {
    case "POINT":
      return pointAreaLabel(index);
    case "ZONE":
      return zoneAreaLabel(index);
    case "WIDE":
      return wideAreaLabel(index).replace("Amplia · ", "");
  }
}

const ZONE_OFFSETS: [number, number][] = [
  [0, 0],
  [-0.06, 0],
  [0.06, 0],
  [0, 0.05],
  [0, -0.05],
];

const WIDE_OFFSETS: [number, number][] = [
  [0, 0],
  [-0.14, 0.08],
  [0.14, -0.08],
  [-0.2, -0.12],
  [0.2, 0.12],
  [0, 0.18],
  [0, -0.18],
];

/** Muestras NDC para raycast (simula búsqueda de contraste en el área). */
export function sampleNdcForActiveArea(
  mode: FocusAreaMode,
  index: number,
): [number, number][] {
  if (mode === "POINT") {
    return [focusPointIndexToNdc(index)];
  }

  if (mode === "ZONE") {
    const [cx, cy] = zoneIndexToNdc(index);
    return ZONE_OFFSETS.map(([ox, oy]) => [cx + ox, cy + oy] as [number, number]);
  }

  const sub = index % FOCUS_WIDE_SUBAREA_COUNT;
  const baseX = sub === 0 ? 0 : sub === 1 ? -0.1 : 0.1;
  return WIDE_OFFSETS.map(([ox, oy]) => [baseX + ox, oy] as [number, number]);
}

export function cycleFocusAreaIndex(mode: FocusAreaMode, current: number): number {
  if (mode === "POINT") return (current + 1) % FOCUS_POINT_COUNT;
  if (mode === "ZONE") return (current + 1) % FOCUS_ZONE_COUNT;
  return (current + 1) % FOCUS_WIDE_SUBAREA_COUNT;
}

export function focusSearchDelayMs(): number {
  return 150 + Math.floor(Math.random() * 200);
}

export interface SimulatedFocusHit {
  distanceM: number;
  targetLabel: string;
  worldPoint: [number, number, number];
  focusConfidence: number;
  focusedObjectId: string | null;
}

export function scoreRaycastHit(
  object: { userData?: { codSubjectId?: string } },
  distance: number,
): { confidence: number; objectId: string | null; label: string } {
  const subjectId = object.userData?.codSubjectId;
  if (
    subjectId === MOVING_SUBJECT_ID ||
    subjectId === VEHICLE_SUBJECT_ID ||
    subjectId === PHOTOGRAPHIC_VEHICLE_SUBJECT_ID ||
    isPhotographicPedestrianId(subjectId) ||
    (typeof subjectId === "string" && PEDESTRIAN_SUBJECT_IDS.includes(subjectId as (typeof PEDESTRIAN_SUBJECT_IDS)[number]))
  ) {
    const label = isPhotographicPedestrianId(subjectId)
      ? "Peatón"
      : typeof subjectId === "string" &&
          PEDESTRIAN_SUBJECT_IDS.includes(subjectId as (typeof PEDESTRIAN_SUBJECT_IDS)[number])
        ? "Persona"
        : subjectId === VEHICLE_SUBJECT_ID || subjectId === PHOTOGRAPHIC_VEHICLE_SUBJECT_ID
          ? "Vehículo"
          : subjectId === MOVING_SUBJECT_ID
            ? "Sujeto"
            : "Persona";
    return {
      confidence: 0.86 + Math.random() * 0.1,
      objectId: subjectId ?? null,
      label,
    };
  }
  const contrastBonus = 0.72 + Math.random() * 0.18;
  return {
    confidence: contrastBonus,
    objectId: null,
    label: distance < 4 ? "Primer plano" : "Fondo",
  };
}

export function pickBestFocusHit(hits: SimulatedFocusHit[]): SimulatedFocusHit | null {
  if (!hits.length) return null;
  return hits.reduce((best, hit) => (hit.focusConfidence > best.focusConfidence ? hit : best));
}

export function roundFocusDistanceM(value: number): number {
  return Math.round(value * 10) / 10;
}
