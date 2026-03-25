import { calculateGrid } from "./math";

export type CropAreaPixels = { x: number; y: number; width: number; height: number };

export type AdjustmentSettings = {
  exposure: number;
  contrast: number;
  shadows: number;
  blacks: number;
  lights: number;
  highlights: number;
  saturation: number;
  temperature: number;
  tint: number;
  sharpen: number;
  backgroundWhiten: number;
  backgroundSmooth: number;
};

export type TemplateConfig = {
  sheetWidthPx: number;
  sheetHeightPx: number;
  photoWidthPx: number;
  photoHeightPx: number;
  marginPx: number;
  gapPx: number;
  backgroundColor?: string;
  guideColor?: string;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const clamp255 = (v: number) => Math.min(255, Math.max(0, v));

export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function rgbToHsl(r: number, g: number, b: number) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  const d = max - min;
  if (d !== 0) {
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h: number, s: number, l: number) {
  if (s === 0) {
    return { r: l, g: l, b: l };
  }
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3),
    g: hue2rgb(p, q, h),
    b: hue2rgb(p, q, h - 1 / 3),
  };
}

function applyBoxBlur(imageData: ImageData, radius: number): ImageData {
  if (radius <= 0) return imageData;
  const { width, height, data } = imageData;
  const out = new ImageData(width, height);
  const outData = out.data;
  const r = Math.min(6, radius);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let as = 0;
      let count = 0;
      for (let ky = -r; ky <= r; ky += 1) {
        const yy = y + ky;
        if (yy < 0 || yy >= height) continue;
        for (let kx = -r; kx <= r; kx += 1) {
          const xx = x + kx;
          if (xx < 0 || xx >= width) continue;
          const idx = (yy * width + xx) * 4;
          rs += data[idx];
          gs += data[idx + 1];
          bs += data[idx + 2];
          as += data[idx + 3];
          count += 1;
        }
      }
      const outIdx = (y * width + x) * 4;
      outData[outIdx] = rs / count;
      outData[outIdx + 1] = gs / count;
      outData[outIdx + 2] = bs / count;
      outData[outIdx + 3] = as / count;
    }
  }
  return out;
}

function applySharpen(imageData: ImageData, amount: number): ImageData {
  if (amount <= 0) return imageData;
  const { width, height, data } = imageData;
  const out = new ImageData(width, height);
  const outData = out.data;
  const strength = Math.min(1, amount / 100);
  const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let ky = -1; ky <= 1; ky += 1) {
        for (let kx = -1; kx <= 1; kx += 1) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const k = kernel[(ky + 1) * 3 + (kx + 1)];
          r += data[idx] * k;
          g += data[idx + 1] * k;
          b += data[idx + 2] * k;
        }
      }
      const outIdx = (y * width + x) * 4;
      outData[outIdx] = clamp255(data[outIdx] * (1 - strength) + r * strength);
      outData[outIdx + 1] = clamp255(data[outIdx + 1] * (1 - strength) + g * strength);
      outData[outIdx + 2] = clamp255(data[outIdx + 2] * (1 - strength) + b * strength);
      outData[outIdx + 3] = data[outIdx + 3];
    }
  }
  return out;
}

export function applyAdjustments(imageData: ImageData, settings: AdjustmentSettings): ImageData {
  const {
    exposure,
    contrast,
    shadows,
    blacks,
    lights,
    highlights,
    saturation,
    temperature,
    tint,
    backgroundWhiten,
    backgroundSmooth,
  } = settings;
  const data = imageData.data;
  const exposureFactor = Math.max(0, 1 + exposure / 100);
  const contrastFactor = 1 + contrast / 100;
  const tempShift = temperature / 100;
  const tintShift = tint / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i] / 255;
    let g = data[i + 1] / 255;
    let b = data[i + 2] / 255;

    r = clamp01(r * exposureFactor);
    g = clamp01(g * exposureFactor);
    b = clamp01(b * exposureFactor);

    r = clamp01((r - 0.5) * contrastFactor + 0.5);
    g = clamp01((g - 0.5) * contrastFactor + 0.5);
    b = clamp01((b - 0.5) * contrastFactor + 0.5);

    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

    const shadowAmount = shadows / 100;
    if (shadowAmount !== 0 && lum < 0.5) {
      const lift = (0.5 - lum) * shadowAmount * 0.9;
      r = clamp01(r + lift);
      g = clamp01(g + lift);
      b = clamp01(b + lift);
    }

    const blackAmount = blacks / 100;
    if (blackAmount !== 0 && lum < 0.25) {
      const lift = (0.25 - lum) * blackAmount * 1.2;
      r = clamp01(r + lift);
      g = clamp01(g + lift);
      b = clamp01(b + lift);
    }

    const lightAmount = lights / 100;
    if (lightAmount !== 0 && lum > 0.5) {
      const boost = (lum - 0.5) * lightAmount * 0.8;
      r = clamp01(r + boost);
      g = clamp01(g + boost);
      b = clamp01(b + boost);
    }

    const highlightAmount = highlights / 100;
    if (highlightAmount !== 0 && lum > 0.75) {
      const boost = (lum - 0.75) * highlightAmount * 1.2;
      r = clamp01(r + boost);
      g = clamp01(g + boost);
      b = clamp01(b + boost);
    }

    if (tempShift !== 0) {
      r = clamp01(r + tempShift * 0.12);
      b = clamp01(b - tempShift * 0.12);
    }
    if (tintShift !== 0) {
      g = clamp01(g + tintShift * 0.12);
      r = clamp01(r - tintShift * 0.06);
      b = clamp01(b - tintShift * 0.06);
    }

    let hsl = rgbToHsl(r, g, b);
    hsl = { ...hsl, s: clamp01(hsl.s * (1 + saturation / 100)) };
    const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    r = rgb.r;
    g = rgb.g;
    b = rgb.b;

    if (backgroundWhiten > 0) {
      const sat = hsl.s;
      const lumNow = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const isBg = lumNow > 0.7 && sat < 0.25;
      if (isBg) {
        const strength = backgroundWhiten / 100;
        const newL = clamp01(hsl.l + (1 - hsl.l) * strength * 0.8);
        const newS = clamp01(hsl.s * (1 - strength));
        const bgRgb = hslToRgb(hsl.h, newS, newL);
        r = bgRgb.r;
        g = bgRgb.g;
        b = bgRgb.b;
      }
    }

    data[i] = clamp255(r * 255);
    data[i + 1] = clamp255(g * 255);
    data[i + 2] = clamp255(b * 255);
  }

  let result = imageData;
  if (backgroundWhiten > 0 && backgroundSmooth > 0) {
    const radius = Math.max(1, Math.round(backgroundSmooth / 6));
    result = applyBoxBlur(result, radius);
  }

  return result;
}

export function createCroppedPhotoCanvas({
  image,
  crop,
  outputWidth,
  outputHeight,
  settings,
  rotation = 0,
}: {
  image: HTMLImageElement;
  crop: CropAreaPixels;
  outputWidth: number;
  outputHeight: number;
  settings: AdjustmentSettings;
  rotation?: number;
}): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const radians = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const rotatedWidth = Math.round(image.naturalWidth * cos + image.naturalHeight * sin);
  const rotatedHeight = Math.round(image.naturalWidth * sin + image.naturalHeight * cos);

  const rotatedCanvas = document.createElement("canvas");
  rotatedCanvas.width = rotatedWidth;
  rotatedCanvas.height = rotatedHeight;
  const rotatedCtx = rotatedCanvas.getContext("2d");
  if (!rotatedCtx) return canvas;

  rotatedCtx.translate(rotatedWidth / 2, rotatedHeight / 2);
  rotatedCtx.rotate(radians);
  rotatedCtx.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2
  );

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, outputWidth, outputHeight);
  ctx.drawImage(
    rotatedCanvas,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    outputWidth,
    outputHeight
  );

  const imageData = ctx.getImageData(0, 0, outputWidth, outputHeight);
  const adjusted = applyAdjustments(imageData, settings);
  const sharpened = applySharpen(adjusted, settings.sharpen);
  ctx.putImageData(sharpened, 0, 0);

  return canvas;
}

export function generateTemplateCanvas({
  photoCanvas,
  config,
}: {
  photoCanvas: HTMLCanvasElement;
  config: TemplateConfig;
}): { canvas: HTMLCanvasElement; grid: ReturnType<typeof calculateGrid> } {
  const {
    sheetWidthPx,
    sheetHeightPx,
    photoWidthPx,
    photoHeightPx,
    marginPx,
    gapPx,
    backgroundColor = "#ffffff",
    guideColor = "#8a8a8a",
  } = config;

  const canvas = document.createElement("canvas");
  canvas.width = sheetWidthPx;
  canvas.height = sheetHeightPx;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return { canvas, grid: calculateGrid({ sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, marginPx, gapPx }) };
  }

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

  const grid = calculateGrid({ sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, marginPx, gapPx });
  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      const x = grid.startX + col * (photoWidthPx + gapPx);
      const y = grid.startY + row * (photoHeightPx + gapPx);
      ctx.drawImage(photoCanvas, x, y, photoWidthPx, photoHeightPx);
    }
  }

  // Guías de corte para guillotina: líneas completas en bordes de fotos
  ctx.strokeStyle = guideColor;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let col = 0; col <= grid.cols; col += 1) {
    const x = grid.startX + col * (photoWidthPx + gapPx) - (col === 0 ? 0 : gapPx);
    ctx.moveTo(x + 0.5, 0.5);
    ctx.lineTo(x + 0.5, sheetHeightPx - 0.5);
  }
  for (let row = 0; row <= grid.rows; row += 1) {
    const y = grid.startY + row * (photoHeightPx + gapPx) - (row === 0 ? 0 : gapPx);
    ctx.moveTo(0.5, y + 0.5);
    ctx.lineTo(sheetWidthPx - 0.5, y + 0.5);
  }
  ctx.stroke();

  // Íconos de tijera en las guías principales.
  ctx.fillStyle = guideColor;
  ctx.font = "14px sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillText("✂", grid.startX + 4, 4);

  return { canvas, grid };
}

export async function exportTemplateImage({
  imageSrc,
  crop,
  settings,
  rotation = 0,
  originalMimeType,
  config,
}: {
  imageSrc: string;
  crop: CropAreaPixels;
  settings: AdjustmentSettings;
  rotation?: number;
  originalMimeType?: string | null;
  config: TemplateConfig;
}): Promise<{ blob: Blob; filename: string; grid: ReturnType<typeof calculateGrid> }> {
  const image = await loadImage(imageSrc);
  const photoCanvas = createCroppedPhotoCanvas({
    image,
    crop,
    outputWidth: config.photoWidthPx,
    outputHeight: config.photoHeightPx,
    settings,
    rotation,
  });
  const { canvas, grid } = generateTemplateCanvas({ photoCanvas, config });

  const isJpeg = originalMimeType === "image/jpeg" || originalMimeType === "image/jpg";
  const mimeType = isJpeg ? "image/jpeg" : "image/png";
  const ext = isJpeg ? "jpg" : "png";
  const quality = isJpeg ? 1 : undefined;

  const blob = await new Promise<Blob>((resolve) => {
    canvas.toBlob((b) => resolve(b || new Blob()), mimeType, quality);
  });
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("") + "_" + [now.getHours(), now.getMinutes()].map((v) => String(v).padStart(2, "0")).join("");
  const filename = `carnet_10x15_300dpi_${config.photoWidthPx}x${config.photoHeightPx}_${stamp}.${ext}`;
  return { blob, filename, grid };
}
