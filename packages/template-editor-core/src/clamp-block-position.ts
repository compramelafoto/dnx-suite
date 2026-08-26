/** Misma lógica que el editor de lienzo: permite salida parcial pero no que el bloque desaparezca del todo. */
export function clampBlockPosition(
  canvasWidth: number,
  canvasHeight: number,
  nextX: number,
  nextY: number,
  blockWidth: number,
  blockHeight: number
): { x: number; y: number } {
  const keepVisible = 24;
  const minX = -blockWidth + keepVisible;
  const maxX = canvasWidth - keepVisible;
  const minY = -blockHeight + keepVisible;
  const maxY = canvasHeight - keepVisible;
  return {
    x: Math.min(maxX, Math.max(minX, nextX)),
    y: Math.min(maxY, Math.max(minY, nextY)),
  };
}
