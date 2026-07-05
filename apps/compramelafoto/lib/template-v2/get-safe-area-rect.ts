import type { TemplateV2Canvas } from "@/lib/template-v2/render-core";

export type SafeAreaRectPx = { x: number; y: number; width: number; height: number };

const MM_PER_INCH = 25.4;

/**
 * Rectángulo de “zona segura” en **coordenadas de lienzo (px)**, solo para guía visual en el editor.
 *
 * - Si `canvas.safeAreaMm` > 0 y `canvas.dpi` > 0: margen = mm × (dpi / 25.4) (misma convención que impresión).
 * - Si `safeAreaMm` > 0 pero no hay dpi: no se inventa dpi; se usa **5%** por lado (referencia estable).
 * - Si no hay `safeAreaMm` (o no aplica): **5%** del ancho y **5%** del alto como inset uniforme.
 *
 * Los inset se limitan para que el rect interior tenga al menos ~1px de lado.
 */
export function getSafeAreaRectPx(canvas: TemplateV2Canvas): SafeAreaRectPx {
  const w = canvas.width;
  const h = canvas.height;
  const maxInsetX = Math.max(0, w / 2 - 0.5);
  const maxInsetY = Math.max(0, h / 2 - 0.5);

  const fallbackInsetX = Math.min(w * 0.05, maxInsetX);
  const fallbackInsetY = Math.min(h * 0.05, maxInsetY);

  let insetX: number;
  let insetY: number;

  const mm = canvas.safeAreaMm;
  if (mm != null && Number.isFinite(mm) && mm > 0) {
    const dpi = canvas.dpi;
    if (dpi != null && Number.isFinite(dpi) && dpi > 0) {
      const pxPerMm = dpi / MM_PER_INCH;
      const m = mm * pxPerMm;
      insetX = Math.min(m, maxInsetX);
      insetY = Math.min(m, maxInsetY);
    } else {
      insetX = fallbackInsetX;
      insetY = fallbackInsetY;
    }
  } else {
    insetX = fallbackInsetX;
    insetY = fallbackInsetY;
  }

  const width = Math.max(1, w - 2 * insetX);
  const height = Math.max(1, h - 2 * insetY);
  return { x: insetX, y: insetY, width, height };
}
