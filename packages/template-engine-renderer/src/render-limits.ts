/** Límites específicos del preview PNG (P0-05). Más estrictos que el save genérico. */
export const TEMPLATE_V2_PREVIEW_LIMITS = {
  maxWidth: 4000,
  maxHeight: 4000,
  maxBlocks: 300,
  maxImages: 50,
  maxScale: 2,
  minScale: 0.25,
  defaultScale: 1,
  renderTimeoutMs: 15_000,
  maxConcurrent: 2,
  maxDataUrlBytes: 1_500_000,
  maxRemoteAssetBytes: 4_000_000,
  maxRemoteRedirects: 2,
  remoteFetchTimeoutMs: 5_000,
  maxTotalAssetBytes: 12_000_000,
} as const;

export function assertPreviewCanvasLimits(width: number, height: number): void {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1 ||
    width > TEMPLATE_V2_PREVIEW_LIMITS.maxWidth ||
    height > TEMPLATE_V2_PREVIEW_LIMITS.maxHeight
  ) {
    throw Object.assign(new Error("canvas_limit"), {
      code: "TEMPLATE_PREVIEW_LIMIT_EXCEEDED",
      message: `Canvas fuera de rango (máx ${TEMPLATE_V2_PREVIEW_LIMITS.maxWidth}×${TEMPLATE_V2_PREVIEW_LIMITS.maxHeight})`,
      width,
      height,
    });
  }
}

export function clampPreviewScale(scale: unknown): number {
  const n = typeof scale === "number" && Number.isFinite(scale) ? scale : TEMPLATE_V2_PREVIEW_LIMITS.defaultScale;
  return Math.min(
    TEMPLATE_V2_PREVIEW_LIMITS.maxScale,
    Math.max(TEMPLATE_V2_PREVIEW_LIMITS.minScale, n)
  );
}
