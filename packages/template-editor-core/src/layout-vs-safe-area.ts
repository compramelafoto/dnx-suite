import type { SafeAreaRectPx } from "@/lib/template-v2/get-safe-area-rect";

/** Comparación del rectángulo de layout (eje alineado) con la zona segura. Sin rotación. */
export type LayoutSafeAreaStatus = "inside" | "partial" | "outside";

/**
 * - `inside`: el rect del bloque está totalmente contenido en `safe`.
 * - `outside`: sin intersección con `safe`.
 * - `partial`: hay intersección pero el bloque no queda totalmente dentro.
 */
export function getLayoutSafeAreaStatus(
  layout: { x: number; y: number; width: number; height: number },
  safe: SafeAreaRectPx
): LayoutSafeAreaStatus {
  const lx2 = layout.x + layout.width;
  const ly2 = layout.y + layout.height;
  const sx2 = safe.x + safe.width;
  const sy2 = safe.y + safe.height;

  const fullyInside =
    layout.x >= safe.x && layout.y >= safe.y && lx2 <= sx2 && ly2 <= sy2;
  if (fullyInside) return "inside";

  const noOverlap = lx2 < safe.x || layout.x > sx2 || ly2 < safe.y || layout.y > sy2;
  if (noOverlap) return "outside";

  return "partial";
}
