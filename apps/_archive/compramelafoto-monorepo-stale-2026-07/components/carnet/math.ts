export const CM_PER_INCH = 2.54;

export function cmToPx(cm: number, dpi: number): number {
  return Math.round((cm / CM_PER_INCH) * dpi);
}

export type GridResult = {
  cols: number;
  rows: number;
  total: number;
  startX: number;
  startY: number;
  gridWidth: number;
  gridHeight: number;
};

export function calculateGrid({
  sheetWidthPx,
  sheetHeightPx,
  photoWidthPx,
  photoHeightPx,
  marginPx,
  gapPx,
  maxTotal,
}: {
  sheetWidthPx: number;
  sheetHeightPx: number;
  photoWidthPx: number;
  photoHeightPx: number;
  marginPx: number;
  gapPx: number;
  maxTotal?: number;
}): GridResult {
  function buildGrid(usedMargin: number): GridResult {
    const usableWidth = Math.max(0, sheetWidthPx - usedMargin * 2);
    const usableHeight = Math.max(0, sheetHeightPx - usedMargin * 2);
    const cols = Math.max(1, Math.floor((usableWidth + gapPx) / (photoWidthPx + gapPx)));
    const rows = Math.max(1, Math.floor((usableHeight + gapPx) / (photoHeightPx + gapPx)));
    const gridWidth = cols * photoWidthPx + (cols - 1) * gapPx;
    const gridHeight = rows * photoHeightPx + (rows - 1) * gapPx;
    const startX = Math.round((sheetWidthPx - gridWidth) / 2);
    const startY = Math.round((sheetHeightPx - gridHeight) / 2);
    return { cols, rows, total: cols * rows, startX, startY, gridWidth, gridHeight };
  }

  const effectiveMaxTotal = maxTotal ?? 6;

  function clampToMaxTotal(grid: GridResult): GridResult {
    if (!effectiveMaxTotal || grid.total <= effectiveMaxTotal) return grid;
    let bestCols = 1;
    let bestRows = 1;
    let bestTotal = 1;
    for (let c = 1; c <= grid.cols; c += 1) {
      for (let r = 1; r <= grid.rows; r += 1) {
        const total = c * r;
        if (total > effectiveMaxTotal) continue;
        if (total > bestTotal) {
          bestTotal = total;
          bestCols = c;
          bestRows = r;
        }
      }
    }
    const gridWidth = bestCols * photoWidthPx + (bestCols - 1) * gapPx;
    const gridHeight = bestRows * photoHeightPx + (bestRows - 1) * gapPx;
    const startX = Math.round((sheetWidthPx - gridWidth) / 2);
    const startY = Math.round((sheetHeightPx - gridHeight) / 2);
    return {
      cols: bestCols,
      rows: bestRows,
      total: bestTotal,
      startX,
      startY,
      gridWidth,
      gridHeight,
    };
  }

  const marginCandidates = Array.from(new Set([marginPx, 0]));
  let bestGrid = clampToMaxTotal(buildGrid(marginCandidates[0]));
  for (const candidateMargin of marginCandidates.slice(1)) {
    const candidate = clampToMaxTotal(buildGrid(candidateMargin));
    if (candidate.total > bestGrid.total) {
      bestGrid = candidate;
    }
  }

  return bestGrid;
}
