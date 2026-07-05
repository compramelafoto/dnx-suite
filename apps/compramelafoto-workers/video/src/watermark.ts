import sharp from "sharp";

export type CreateWatermarkOverlayParams = {
  videoId: number;
  width: number;
  height: number;
  outputPath: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function watermarkFontSize(width: number, height: number): number {
  return Math.max(16, Math.round(Math.min(width, height) * 0.045));
}

function buildWatermarkSvg(width: number, height: number, videoId: number): string {
  const fontSize = watermarkFontSize(width, height);
  const pad = Math.round(fontSize * 1.4);
  const line1 = "ComprameLaFoto";
  const line2 = "VistaPrevia";
  const line3 = `Video${videoId}`;

  const topY = pad + fontSize;
  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2 + fontSize / 3);
  const bottomX = width - pad;
  const bottomY = height - pad;

  const textStyle = `font-family="Arial, Helvetica, sans-serif" font-size="${fontSize}" fill="white" fill-opacity="0.35" filter="url(#wm-shadow)"`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <filter id="wm-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.25"/>
    </filter>
  </defs>
  <text x="${pad}" y="${topY}" ${textStyle}>${escapeXml(line1)}</text>
  <text x="${centerX}" y="${centerY}" text-anchor="middle" ${textStyle}>${escapeXml(line2)}</text>
  <text x="${bottomX}" y="${bottomY}" text-anchor="end" ${textStyle}>${escapeXml(line3)}</text>
</svg>`;
}

/**
 * Capa PNG transparente del tamaño del preview (mismo width/height que merged.mp4).
 */
export async function createWatermarkOverlayFile(
  params: CreateWatermarkOverlayParams
): Promise<void> {
  const { videoId, width, height, outputPath } = params;
  const w = Math.max(2, Math.round(width));
  const h = Math.max(2, Math.round(height));

  const svg = buildWatermarkSvg(w, h, videoId);
  await sharp(Buffer.from(svg)).png().toFile(outputPath);

  console.log("[video-worker] watermark overlay generated", {
    videoId,
    width: w,
    height: h,
    outputPath,
  });
}
