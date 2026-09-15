import sharp from "sharp";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

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


/**
 * Rejilla de logos, igual que las fotos.
 *
 * Antes la marca del video eran tres textos sueltos que no tapaban nada: quien
 * se llevaba el adelanto tenía una imagen casi limpia. Las fotos usan el logo
 * repetido en rejilla, y el video ahora hace lo mismo con el mismo archivo.
 *
 * Los números salen de `lib/images/watermark-render.ts` de la app: rejilla de
 * 3x3 y logo al 22% del ancho (con el factor 1.23 que se aplicó allá).
 */
const LOGO_GRID_COLS = 3;
const LOGO_GRID_ROWS = 3;
const LOGO_WIDTH_RATIO = 0.22 * 1.23;
const LOGO_OPACITY = 0.45;

/** Ubica el logo de CLF, que viaja junto al worker. */
function resolveLogoPath(): string | null {
  const candidatos = [
    path.join(process.cwd(), "assets", "watermark.png"),
    path.join(process.cwd(), "apps", "compramelafoto-workers", "video", "assets", "watermark.png"),
    path.resolve(fileURLToPath(import.meta.url), "..", "..", "assets", "watermark.png"),
  ];
  for (const c of candidatos) {
    if (existsSync(c)) return c;
  }
  console.warn("[video-worker] watermark.png no encontrado: la marca queda sólo con texto");
  return null;
}

/** Las capas de logo repetidas sobre el cuadro. */
async function buildLogoTiles(
  width: number,
  height: number
): Promise<sharp.OverlayOptions[]> {
  const logoPath = resolveLogoPath();
  if (!logoPath) return [];

  const logoAncho = Math.max(24, Math.round(width * LOGO_WIDTH_RATIO));
  const logo = await sharp(logoPath)
    .resize({ width: logoAncho })
    .composite([
      {
        // Baja la opacidad del logo sin tocar el archivo original.
        input: Buffer.from([255, 255, 255, Math.round(255 * LOGO_OPACITY)]),
        raw: { width: 1, height: 1, channels: 4 },
        tile: true,
        blend: "dest-in",
      },
    ])
    .png()
    .toBuffer();

  const meta = await sharp(logo).metadata();
  const lw = meta.width ?? logoAncho;
  const lh = meta.height ?? logoAncho;

  const capas: sharp.OverlayOptions[] = [];
  for (let fila = 0; fila < LOGO_GRID_ROWS; fila++) {
    for (let col = 0; col < LOGO_GRID_COLS; col++) {
      const cx = ((col + 0.5) * width) / LOGO_GRID_COLS;
      const cy = ((fila + 0.5) * height) / LOGO_GRID_ROWS;
      const left = Math.round(cx - lw / 2);
      const top = Math.round(cy - lh / 2);
      // Un logo que se sale del cuadro hace fallar la composición entera.
      if (left < 0 || top < 0 || left + lw > width || top + lh > height) continue;
      capas.push({ input: logo, left, top });
    }
  }
  return capas;
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
  const tiles = await buildLogoTiles(w, h);

  await sharp(Buffer.from(svg))
    .composite(tiles)
    .png()
    .toFile(outputPath);

  console.log("[video-worker] watermark overlay generated", {
    videoId,
    width: w,
    height: h,
    outputPath,
  });
}
