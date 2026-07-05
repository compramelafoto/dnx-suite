import sharp from "sharp";
import {
  buildSvgEmbeddedFontDefs,
  sanitizeWatermarkAscii,
  watermarkFontFamilyCss,
} from "@/lib/images/watermark-svg-font";

export type ProtectedPreviewWatermarkMode = "standard" | "strong";

export type ApplyProtectedPreviewWatermarkOptions = {
  photoId?: number | string;
  text?: string;
  width?: number;
  height?: number;
  /** Lado máximo tras resize (default 1200) */
  maxSide?: number;
  mode?: ProtectedPreviewWatermarkMode;
  showPhotoId?: boolean;
  /** Override calidad JPEG (65–75 recomendado para previews) */
  jpegQuality?: number;
  /** SIMPLE | EVENT | SCHOOL | COLLABORATIVE — solo logs / trazabilidad */
  albumType?: string | null;
  /** preview | thumb — solo logs */
  previewType?: string | null;
};

/** Versión para invalidar cache R2 de `/api/photos/[id]/view` */
export const PROTECTED_PREVIEW_WATERMARK_VERSION = "ppw3";

const LOG_PREFIX = "[protected-preview]";

const PREVIEW_MAX_SIDE_DEFAULT = 1200;
const JPEG_QUALITY_STANDARD = 72;
const JPEG_QUALITY_STRONG = 66;
const THUMB_EXTRA_QUALITY = 38;

export function isProtectedPreviewWatermarkEnabled(): boolean {
  const raw = process.env.PROTECTED_PREVIEW_WATERMARK?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function getProtectedPreviewWatermarkMode(): ProtectedPreviewWatermarkMode {
  const raw = process.env.PROTECTED_PREVIEW_WATERMARK_MODE?.trim().toLowerCase();
  return raw === "strong" ? "strong" : "standard";
}

function escapeXml(text: string): string {
  return sanitizeWatermarkAscii(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function logProtectedPreview(event: Record<string, unknown>) {
  console.info(LOG_PREFIX, event);
}

function buildTilePatternSvg(params: {
  patternId: string;
  patternSize: number;
  fontSize: number;
  opacity: number;
  rotationDeg: number;
  texts: string[];
  strokeWidth: number;
}): string {
  const { patternSize, fontSize, opacity, rotationDeg, texts, strokeWidth } = params;
  const lineSpacing = Math.max(fontSize * 1.35, 18);
  const textRows = texts
    .map((text, i) => {
      const safe = escapeXml(text);
      const y = fontSize * 1.1 + i * lineSpacing;
      return `
        <text
          x="${Math.floor(patternSize * 0.06)}"
          y="${y}"
          font-family="${watermarkFontFamilyCss()}"
          font-size="${fontSize}"
          font-weight="600"
          fill="white"
          fill-opacity="${opacity}"
          stroke="black"
          stroke-width="${strokeWidth}"
          stroke-opacity="${Math.min(0.4, opacity + 0.08)}"
          paint-order="stroke fill"
        >${safe}</text>`;
    })
    .join("");

  return `
    <pattern id="${params.patternId}" patternUnits="userSpaceOnUse" width="${patternSize}" height="${patternSize}" patternTransform="rotate(${rotationDeg})">
      ${textRows}
    </pattern>`;
}

export function buildProtectedPreviewWatermarkSvg(params: {
  width: number;
  height: number;
  mode: ProtectedPreviewWatermarkMode;
  photoId?: number | string;
  customText?: string;
}): Buffer {
  const { width, height, mode } = params;
  const isStrong = mode === "strong";
  const minDim = Math.min(width, height);
  const fontSize = Math.max(11, Math.floor(minDim / (isStrong ? 22 : 26)));
  const centerFontSize = Math.max(16, Math.floor(minDim / (isStrong ? 11 : 13)));
  const strokeWidth = Math.max(0.5, fontSize * 0.05);

  const tileOpacityLow = isStrong ? 0.14 : 0.1;
  const tileOpacityMid = isStrong ? 0.18 : 0.13;
  const tileOpacityHigh = isStrong ? 0.22 : 0.16;
  const centerOpacity = isStrong ? 0.34 : 0.24;

  const photoLineRaw =
    params.photoId != null && String(params.photoId).trim()
      ? sanitizeWatermarkAscii(`Foto #${String(params.photoId).trim()}`)
      : null;

  const customLine = params.customText
    ? sanitizeWatermarkAscii(params.customText)
    : null;

  const patternTextsA = ["ComprameLaFoto", "Vista previa - ComprameLaFoto", ...(photoLineRaw ? [photoLineRaw] : [])];
  const patternTextsB = [
    "Vista previa",
    "ComprameLaFoto",
    ...(customLine ? [customLine] : []),
    ...(photoLineRaw ? [photoLineRaw] : []),
  ];

  const patternSize = Math.max(200, Math.floor(fontSize * 9));
  const patterns = [
    buildTilePatternSvg({
      patternId: "ppw-a",
      patternSize,
      fontSize,
      opacity: tileOpacityLow,
      rotationDeg: -32,
      texts: patternTextsA,
      strokeWidth,
    }),
    buildTilePatternSvg({
      patternId: "ppw-b",
      patternSize: Math.floor(patternSize * 1.15),
      fontSize: Math.max(10, fontSize - 1),
      opacity: tileOpacityMid,
      rotationDeg: 24,
      texts: patternTextsB,
      strokeWidth,
    }),
    buildTilePatternSvg({
      patternId: "ppw-c",
      patternSize: Math.floor(patternSize * 0.92),
      fontSize: Math.max(10, fontSize - 2),
      opacity: tileOpacityHigh,
      rotationDeg: -58,
      texts: ["ComprameLaFoto", "Vista previa"],
      strokeWidth,
    }),
  ].join("\n");

  const centerLines = ["ComprameLaFoto", "Vista previa - ComprameLaFoto", ...(photoLineRaw ? [photoLineRaw] : [])];
  const centerTspans = centerLines
    .map((line, i) => {
      const dy = i === 0 ? 0 : centerFontSize * 1.12;
      return `<tspan x="50%" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  const cornerMarks = [
    { x: "18%", y: "22%", rot: -24, text: "Vista previa", op: tileOpacityMid },
    { x: "78%", y: "28%", rot: 18, text: "ComprameLaFoto", op: tileOpacityLow },
    { x: "22%", y: "76%", rot: 20, text: "ComprameLaFoto", op: tileOpacityLow },
    { x: "80%", y: "72%", rot: -20, text: "Vista previa", op: tileOpacityMid },
  ]
    .map(
      (m) => `
    <text
      x="${m.x}"
      y="${m.y}"
      transform="rotate(${m.rot} ${m.x} ${m.y})"
      font-family="${watermarkFontFamilyCss()}"
      font-size="${Math.max(10, fontSize - 1)}"
      font-weight="600"
      fill="white"
      fill-opacity="${m.op}"
      stroke="black"
      stroke-width="${strokeWidth}"
      stroke-opacity="0.35"
      text-anchor="middle"
      dominant-baseline="middle"
      paint-order="stroke fill"
    >${escapeXml(m.text)}</text>`
    )
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${buildSvgEmbeddedFontDefs()}
    ${patterns}
  </defs>
  <rect width="100%" height="100%" fill="url(#ppw-a)" />
  <rect width="100%" height="100%" fill="url(#ppw-b)" opacity="0.92" />
  <rect width="100%" height="100%" fill="url(#ppw-c)" opacity="0.85" />
  ${cornerMarks}
  <text
    x="50%"
    y="50%"
    font-family="${watermarkFontFamilyCss()}"
    font-size="${centerFontSize}"
    font-weight="normal"
    fill="white"
    fill-opacity="${centerOpacity}"
    stroke="black"
    stroke-width="${Math.max(1, Math.floor(centerFontSize * 0.06))}"
    stroke-opacity="0.55"
    text-anchor="middle"
    dominant-baseline="middle"
    paint-order="stroke fill"
  >${centerTspans}</text>
</svg>`;

  return Buffer.from(svg, "utf8");
}

function buildSubtleNoiseOverlaySvg(width: number, height: number, strength: number): Buffer {
  const opacity = strength > 0.5 ? 0.045 : 0.03;
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="ppw-noise" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" stitchTiles="stitch" result="noise"/>
      <feColorMatrix type="saturate" values="0" in="noise" result="mono"/>
      <feBlend in="SourceGraphic" in2="mono" mode="overlay" />
    </filter>
  </defs>
  <rect width="100%" height="100%" filter="url(#ppw-noise)" opacity="${opacity}" />
</svg>`;
  return Buffer.from(svg, "utf8");
}

/**
 * Aplica watermark distribuido + degradación leve para previews públicas.
 * No usar en originales ni entregas post-compra.
 */
export async function applyProtectedPreviewWatermark(
  inputBuffer: Buffer,
  options: ApplyProtectedPreviewWatermarkOptions = {}
): Promise<Buffer> {
  const mode = options.mode ?? getProtectedPreviewWatermarkMode();
  const maxSide = options.maxSide ?? PREVIEW_MAX_SIDE_DEFAULT;
  const isThumb = maxSide <= 400;

  const rotated = sharp(inputBuffer).rotate();
  const meta = await rotated.metadata();
  const sourceWidth = meta.width ?? options.width ?? maxSide;
  const sourceHeight = meta.height ?? options.height ?? maxSide;

  const resizedBuffer = await rotated
    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: true })
    .toBuffer();

  const resizedMeta = await sharp(resizedBuffer).metadata();
  const outW = resizedMeta.width ?? sourceWidth;
  const outH = resizedMeta.height ?? sourceHeight;

  const showPhotoId = options.showPhotoId !== false;
  const photoIdForMark =
    showPhotoId && options.photoId != null && String(options.photoId).trim()
      ? options.photoId
      : undefined;

  const watermarkSvg = buildProtectedPreviewWatermarkSvg({
    width: outW,
    height: outH,
    mode,
    photoId: photoIdForMark,
    customText: options.text,
  });

  const noiseSvg = buildSubtleNoiseOverlaySvg(outW, outH, mode === "strong" ? 1 : 0.5);

  const defaultQuality =
    options.jpegQuality ??
    (isThumb ? THUMB_EXTRA_QUALITY : mode === "strong" ? JPEG_QUALITY_STRONG : JPEG_QUALITY_STANDARD);

  let pipeline = sharp(resizedBuffer).composite([
    { input: watermarkSvg, blend: "over" },
    { input: noiseSvg, blend: "overlay" },
  ]);

  if (mode === "strong" && !isThumb) {
    pipeline = pipeline.blur(0.35).sharpen({ sigma: 0.6, m1: 0.5, m2: 0.25 });
  }

  const outputBuffer = await pipeline
    .jpeg({
      quality: defaultQuality,
      mozjpeg: true,
      progressive: !isThumb,
    })
    .toBuffer();

  logProtectedPreview({
    photoId: options.photoId ?? null,
    albumType: options.albumType ?? null,
    mode,
    previewType: options.previewType ?? (isThumb ? "thumb" : "preview"),
    watermarkApplied: true,
    maxSide,
    outputWidth: outW,
    outputHeight: outH,
    outputQuality: defaultQuality,
  });

  return outputBuffer;
}
