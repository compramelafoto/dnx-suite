"use client";

import { useEffect, useRef, useState } from "react";
import { cmToPx } from "./math";
import {
  createCroppedPhotoCanvas,
  loadImage,
  type AdjustmentSettings,
  type CropAreaPixels,
} from "./export";

export default function CroppedPreview({
  imageSrc,
  crop,
  rotation,
  settings,
  sizeCm,
}: {
  imageSrc: string | null;
  crop: CropAreaPixels | null;
  rotation: number;
  settings: AdjustmentSettings;
  sizeCm: { width: number; height: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!imageSrc || !crop || !canvasRef.current) return;
    let active = true;
    async function renderPreview(src: string, area: CropAreaPixels) {
      setLoading(true);
      try {
        const dpi = 300;
        const outputWidth = cmToPx(sizeCm.width, dpi);
        const outputHeight = cmToPx(sizeCm.height, dpi);
        const image = await loadImage(src);
        const previewCanvas = createCroppedPhotoCanvas({
          image,
          crop: area,
          outputWidth,
          outputHeight,
          settings,
          rotation,
        });
        if (!active || !canvasRef.current) return;
        canvasRef.current.width = previewCanvas.width;
        canvasRef.current.height = previewCanvas.height;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        ctx.drawImage(previewCanvas, 0, 0);
      } finally {
        if (active) setLoading(false);
      }
    }
    renderPreview(imageSrc, crop);
    return () => {
      active = false;
    };
  }, [imageSrc, crop, rotation, settings, sizeCm.width, sizeCm.height]);

  return (
    <div className="space-y-2">
      <div className="text-sm text-[#6b7280]">Vista previa del recorte</div>
      <div
        className="rounded-xl border border-[#e5e7eb] bg-white p-4 w-full"
        style={{
          aspectRatio: crop ? `${crop.width} / ${crop.height}` : `${sizeCm.width} / ${sizeCm.height}`,
        }}
      >
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
      {loading && <div className="text-xs text-[#6b7280]">Actualizando preview...</div>}
    </div>
  );
}
