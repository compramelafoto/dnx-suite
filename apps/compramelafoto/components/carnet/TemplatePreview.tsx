"use client";

import { useEffect, useRef, useState } from "react";
import { cmToPx } from "./math";
import {
  createCroppedPhotoCanvas,
  generateTemplateCanvas,
  loadImage,
  type AdjustmentSettings,
  type CropAreaPixels,
} from "./export";

async function loadWatermarkLogo() {
  return loadImage("/watermark.png");
}

export default function TemplatePreview({
  imageSrc,
  crop,
  rotation,
  settings,
  sizeCm,
  marginCm,
  gapCm,
  watermarkText,
  watermarkOpacity = 0.5,
}: {
  imageSrc: string | null;
  crop: CropAreaPixels | null;
  rotation: number;
  settings: AdjustmentSettings;
  sizeCm: { width: number; height: number };
  marginCm: number;
  gapCm: number;
  watermarkText?: string;
  watermarkOpacity?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageSrc || !crop || !canvasRef.current) return;
    let active = true;
    async function renderPreview(src: string) {
      setLoading(true);
      try {
        const dpi = 120;
        const sheetWidthPx = cmToPx(10.2, dpi);
        const sheetHeightPx = cmToPx(15.2, dpi);
        const photoWidthPx = cmToPx(sizeCm.width, dpi);
        const photoHeightPx = cmToPx(sizeCm.height, dpi);
        const marginPx = cmToPx(marginCm, dpi);
        const gapPx = cmToPx(gapCm, dpi);

        const image = await loadImage(src);
        const photoCanvas = createCroppedPhotoCanvas({
          image,
          crop: crop ?? { x: 0, y: 0, width: image.width, height: image.height },
          outputWidth: photoWidthPx,
          outputHeight: photoHeightPx,
          settings,
          rotation,
        });
        const { canvas } = generateTemplateCanvas({
          photoCanvas,
          config: { sheetWidthPx, sheetHeightPx, photoWidthPx, photoHeightPx, marginPx, gapPx },
        });

        if (!active || !canvasRef.current) return;
        canvasRef.current.width = canvas.width;
        canvasRef.current.height = canvas.height;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas, 0, 0);

        if (watermarkText) {
          ctx.save();
          ctx.globalAlpha = watermarkOpacity;
          ctx.fillStyle = "#ffffff";
          ctx.font = "20px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          const cols = 3;
          const rows = 2;
          const stepX = canvas.width / (cols + 1);
          const stepY = canvas.height / (rows + 1);
          for (let row = 1; row <= rows; row += 1) {
            for (let col = 1; col <= cols; col += 1) {
              const x = stepX * col;
              const y = stepY * row;
              ctx.save();
              ctx.translate(x, y);
              ctx.rotate((-20 * Math.PI) / 180);
              ctx.fillText(watermarkText, 0, 0);
              ctx.restore();
            }
          }
          ctx.restore();
        }

        try {
          const logo = await loadWatermarkLogo();
          const logoWidth = Math.round(canvas.width * 0.18);
          const logoHeight = Math.round((logo.naturalHeight / logo.naturalWidth) * logoWidth);
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.drawImage(
            logo,
            canvas.width - logoWidth - 24,
            canvas.height - logoHeight - 24,
            logoWidth,
            logoHeight
          );
          ctx.restore();
        } catch {
          // si falla la carga del logo, continuar sin bloquear
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    renderPreview(imageSrc);
    return () => {
      active = false;
    };
  }, [
    imageSrc,
    crop,
    rotation,
    settings,
    sizeCm.width,
    sizeCm.height,
    marginCm,
    gapCm,
    watermarkText,
    watermarkOpacity,
  ]);

  return (
    <div className="space-y-2">
      <div className="text-sm text-[#6b7280]">Vista previa (baja resolución)</div>
      <div className="rounded-lg border border-[#e5e7eb] bg-white p-2 overflow-auto">
        <canvas ref={canvasRef} className="max-w-full h-auto" />
      </div>
      {loading && (
        <div className="text-xs text-[#6b7280]">Actualizando preview...</div>
      )}
    </div>
  );
}
