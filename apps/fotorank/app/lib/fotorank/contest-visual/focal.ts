import type { ContestFocalPoint, ContestMediaAsset } from "./presentation";

const DEFAULT_FOCAL: ContestFocalPoint = { x: 50, y: 50 };

/** Clampa un valor a [0, 100]. null/undefined → fallback (Number(null) es 0). */
export function clampFocalAxis(value: unknown, fallback = 50): number {
  if (value === null || value === undefined || value === "") return fallback;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(0, n));
}

export function normalizeFocalPoint(
  x?: number | null,
  y?: number | null,
): ContestFocalPoint {
  return {
    x: clampFocalAxis(x, DEFAULT_FOCAL.x),
    y: clampFocalAxis(y, DEFAULT_FOCAL.y),
  };
}

/** Convierte punto focal 0–100 a `object-position` CSS. */
export function focalToObjectPosition(x?: number | null, y?: number | null): string {
  const p = normalizeFocalPoint(x, y);
  return `${p.x}% ${p.y}%`;
}

export function assetObjectPosition(asset: ContestMediaAsset | null | undefined): string {
  if (!asset) return focalToObjectPosition(50, 50);
  return focalToObjectPosition(asset.focalPointX, asset.focalPointY);
}
