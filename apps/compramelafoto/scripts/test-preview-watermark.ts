/**
 * Compara si `/api/photos/.../mode=preview` ya contiene capa de watermark.
 * Uso: npx tsx scripts/test-preview-watermark.ts [photoId] [albumId] [baseUrl]
 */
import sharp from "sharp";
import fs from "fs";
import path from "path";
import {
  buildTiledWatermarkSvg,
  WATERMARK_TILED_TEXT,
} from "../lib/watermarking";

async function buildPngComposites(imageWidth: number, imageHeight: number) {
  const WATERMARK_SCALE = 0.25 * 1.15 * 1.25 * 0.5;
  const WATERMARK_PNG_OPACITY = 0.2109375;
  const watermarkPath = path.join(process.cwd(), "public", "watermark.png");
  const watermarkBuffer = fs.readFileSync(watermarkPath);
  const watermark = sharp(watermarkBuffer);
  const watermarkMetadata = await watermark.metadata();
  if (!watermarkMetadata.width || !watermarkMetadata.height) return [];

  const cellWidth = Math.floor(imageWidth / 3);
  const cellHeight = Math.floor(imageHeight / 3);
  const maxWatermarkWidth = Math.max(
    1,
    Math.min(
      Math.floor(imageWidth * WATERMARK_SCALE),
      cellWidth - 2,
      imageWidth - 2
    )
  );
  const maxWatermarkHeight = Math.max(
    1,
    Math.min(
      Math.floor(imageHeight * WATERMARK_SCALE),
      cellHeight - 2,
      imageHeight - 2
    )
  );
  const watermarkWidth = maxWatermarkWidth;
  const watermarkHeight = Math.floor(
    (watermarkMetadata.height * watermarkWidth) / watermarkMetadata.width
  );
  const resizedWatermark = await watermark
    .resize(watermarkWidth, Math.min(watermarkHeight, maxWatermarkHeight), {
      fit: "inside",
    })
    .png()
    .toBuffer();

  const composites: Array<{
    input: Buffer;
    top: number;
    left: number;
    blend?: sharp.Blend;
    opacity?: number;
  }> = [];
  const offsetX = Math.max(0, Math.floor((cellWidth - watermarkWidth) / 2));
  const offsetY = Math.max(
    0,
    Math.floor((cellHeight - Math.min(watermarkHeight, maxWatermarkHeight)) / 2)
  );

  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      composites.push({
        input: resizedWatermark,
        top: Math.max(0, row * cellHeight + offsetY),
        left: Math.max(0, col * cellWidth + offsetX),
        blend: "over",
        opacity: WATERMARK_PNG_OPACITY,
      });
    }
  }
  return composites;
}

async function mse(a: Buffer, b: Buffer) {
  const A = await sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(b)
    .resize(A.info.width, A.info.height)
    .ensureAlpha()
    .raw()
    .toBuffer();
  let s = 0;
  const n = Math.min(A.data.length, B.length);
  for (let i = 0; i < n; i++) s += (A.data[i] - B[i]) ** 2;
  return s / n;
}

async function main() {
  const photoId = process.argv[2] || "60640";
  const albumId = process.argv[3] || "315";
  const base = process.argv[4] || "http://localhost:3000";
  const bust = Date.now();

  const prevRes = await fetch(
    `${base}/api/photos/${photoId}/view?albumId=${albumId}&mode=preview&b=${bust}`
  );
  const thumbRes = await fetch(
    `${base}/api/photos/${photoId}/view?albumId=${albumId}&mode=thumb&b=${bust}`
  );
  if (!prevRes.ok) throw new Error(`preview HTTP ${prevRes.status}`);
  if (!thumbRes.ok) throw new Error(`thumb HTTP ${thumbRes.status}`);

  const prev = Buffer.from(await prevRes.arrayBuffer());
  const thumb = Buffer.from(await thumbRes.arrayBuffer());
  const meta = await sharp(prev).metadata();
  const w = meta.width || 850;
  const h = meta.height || 638;

  const fontSize = Math.max(22, Math.floor(Math.min(w, h) / 18));
  const scaledFontSize = Math.max(12, Math.floor(fontSize * 0.75));
  const overlay = buildTiledWatermarkSvg({
    width: w,
    height: h,
    text: WATERMARK_TILED_TEXT,
    opacity: 0.5,
    fontSize: scaledFontSize,
    rotations: [0, -30, 30, -60],
    centerText: "compramelafoto.com",
    blurStdDev: Math.max(0.1, scaledFontSize * 0.05),
    blurDx: Math.max(0.1, scaledFontSize * 0.05),
    blurDy: 0,
  });
  const pngComposites = await buildPngComposites(w, h);

  const doubleWm = await sharp(prev)
    .composite([...pngComposites, { input: overlay, blend: "over" }])
    .jpeg({ quality: 50 })
    .toBuffer();

  const upscaledThumb = await sharp(thumb)
    .resize(w, h, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .jpeg({ quality: 50 })
    .toBuffer();

  const withWmOnThumb = await sharp(upscaledThumb)
    .composite([...pngComposites, { input: overlay, blend: "over" }])
    .jpeg({ quality: 50 })
    .toBuffer();

  const mseDoubleLayer = await mse(prev, doubleWm);
  const mseVsPlainThumb = await mse(prev, upscaledThumb);
  const mseVsWmThumb = await mse(prev, withWmOnThumb);
  const thumbMeta = await sharp(thumb).metadata();
  const plainThumbFromPreview = await sharp(prev)
    .resize(thumbMeta.width || 320, thumbMeta.height || 320, { fit: "inside" })
    .jpeg({ quality: 38 })
    .toBuffer();
  const mseThumbVsPlainResize = await mse(thumb, plainThumbFromPreview);

  console.log(
    JSON.stringify(
      {
        previewBytes: prev.length,
        thumbBytes: thumb.length,
        dimensions: { w, h },
        msePreviewVsDoubleWatermark: Number(mseDoubleLayer.toFixed(2)),
        msePreviewVsUpscaledThumbPlain: Number(mseVsPlainThumb.toFixed(2)),
        msePreviewVsWatermarkedUpscaledThumb: Number(mseVsWmThumb.toFixed(2)),
        mseThumbVsPlainResizeFromPreview: Number(mseThumbVsPlainResize.toFixed(2)),
        previewVerdict:
          mseVsWmThumb < mseVsPlainThumb ? "preview_HAS_watermark" : "preview_MISSING_watermark",
        thumbVerdict:
          mseThumbVsPlainResize > 80 ? "thumb_HAS_watermark" : "thumb_MISSING_watermark",
      },
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
