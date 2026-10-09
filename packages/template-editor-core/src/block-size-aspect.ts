/**
 * Medida y proporción de un bloque: lo que el diseñador muestra al estirar un recuadro y lo
 * que ofrece el inspector para fijar formatos de foto y redes (1:1, 4:5, 16:9…).
 *
 * El layout vive en píxeles del lienzo; los milímetros salen del `dpi` del lienzo, igual que
 * en el modal de tamaño de hoja.
 */
import { asObject } from "./render-core";
import {
  cmFromPx,
  mmFromPx,
  TEMPLATE_V2_EXPORT_DPI,
  type CanvasDimUnit,
} from "./canvas-print-units";

export type AspectPreset = {
  /** Etiqueta tal cual se muestra: "4:5". */
  label: string;
  /** Ancho / alto. */
  ratio: number;
  /** Para qué se usa, en criollo. */
  hint: string;
};

/** Formatos más usados en fotografía y redes, primero los horizontales y el cuadrado. */
export const ASPECT_PRESETS: AspectPreset[] = [
  { label: "1:1", ratio: 1, hint: "Cuadrado · Instagram" },
  { label: "3:2", ratio: 3 / 2, hint: "Cámara réflex / mirrorless" },
  { label: "4:3", ratio: 4 / 3, hint: "Celular · Micro 4/3" },
  { label: "16:9", ratio: 16 / 9, hint: "YouTube · pantallas" },
  { label: "4:5", ratio: 4 / 5, hint: "Instagram vertical (feed)" },
  { label: "2:3", ratio: 2 / 3, hint: "Cámara en vertical" },
  { label: "3:4", ratio: 3 / 4, hint: "Celular en vertical" },
  { label: "9:16", ratio: 9 / 16, hint: "Historias · Reels · TikTok" },
];

/** Diferencia relativa tolerada para decir que un recuadro "es" 4:3 (los píxeles redondean). */
const ASPECT_TOLERANCE = 0.01;

export function findAspectPreset(width: number, height: number): AspectPreset | null {
  if (!(width > 0) || !(height > 0)) return null;
  const r = width / height;
  for (const p of ASPECT_PRESETS) {
    if (Math.abs(r - p.ratio) / p.ratio <= ASPECT_TOLERANCE) return p;
  }
  return null;
}

/** "4:3" si coincide con un formato conocido; si no, "1,42:1" (o "1:1,42" en vertical). */
export function describeAspect(width: number, height: number): string {
  const preset = findAspectPreset(width, height);
  if (preset) return preset.label;
  if (!(width > 0) || !(height > 0)) return "—";
  const fmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("es-AR");
  return width >= height ? `${fmt(width / height)}:1` : `1:${fmt(height / width)}`;
}

export function canvasDpi(canvas: { dpi?: number }): number {
  return typeof canvas.dpi === "number" && canvas.dpi > 0 ? canvas.dpi : TEMPLATE_V2_EXPORT_DPI;
}

/** Valor de una medida en la unidad pedida, redondeado para mostrar. */
export function sizeInUnit(px: number, unit: CanvasDimUnit, dpi: number): number {
  if (unit === "px") return Math.round(px);
  if (unit === "cm") return Math.round(cmFromPx(px, dpi) * 100) / 100;
  return Math.round(mmFromPx(px, dpi) * 10) / 10;
}

/** "85 × 55 mm", "8,5 × 5,5 cm" o "1004 × 650 px". */
export function formatBlockSize(width: number, height: number, unit: CanvasDimUnit, dpi: number): string {
  const f = (px: number) => sizeInUnit(px, unit, dpi).toLocaleString("es-AR");
  return `${f(width)} × ${f(height)} ${unit}`;
}

/** Proporción fijada en el bloque (ancho / alto) o null si es libre. */
export function getBlockAspectLock(configJson: unknown): number | null {
  const v = asObject(configJson).aspectLock;
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

type Box = { x: number; y: number; width: number; height: number };

/**
 * Lleva el recuadro a la proporción pedida sin moverle el centro. Conserva el ancho y ajusta
 * el alto; si así se sale del lienzo, achica los dos lados hasta que entre.
 */
export function fitBoxToAspect(box: Box, ratio: number, canvas: { width: number; height: number }): Box {
  if (!(ratio > 0)) return box;
  let width = box.width;
  let height = width / ratio;
  const maxW = Math.max(1, canvas.width);
  const maxH = Math.max(1, canvas.height);
  const shrink = Math.min(1, maxW / width, maxH / height);
  width *= shrink;
  height *= shrink;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { x: cx - width / 2, y: cy - height / 2, width, height };
}
