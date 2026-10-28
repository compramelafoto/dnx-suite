"use client";

import { useEffect, useRef, useState } from "react";
import type { PolaroidItem } from "./export";
import { renderPolaroidToCanvas, renderSheetToCanvas } from "./export";
import type { PolaroidPreset } from "./presets";

export default function SheetPreview({
  items,
  preset,
  sheetIndex,
}: {
  items: PolaroidItem[];
  preset: PolaroidPreset;
  sheetIndex: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!canvasRef.current) return;
    let active = true;
    async function render() {
      setLoading(true);
      try {
        const perSheet = preset.maxPerSheet ?? 2;
        const start = sheetIndex * perSheet;
        const slice = items.slice(start, start + perSheet);
        if (!slice.length) return;
        const polaroids = [];
        for (const item of slice) {
          polaroids.push(await renderPolaroidToCanvas(item, preset, 120));
        }
        const canvas = renderSheetToCanvas(polaroids, preset, 120);
        if (!active || !canvasRef.current) return;
        canvasRef.current.width = canvas.width;
        canvasRef.current.height = canvas.height;
        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(canvas, 0, 0);
      } finally {
        if (active) setLoading(false);
      }
    }
    render();
    return () => {
      active = false;
    };
  }, [items, preset, sheetIndex]);

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium text-[#1a1a1a]">Previsualización de hoja</div>
      <div className="rounded-xl border border-[#e5e7eb] bg-white p-3">
        <canvas ref={canvasRef} className="w-full h-auto" />
      </div>
      {loading && <div className="text-xs text-[#6b7280]">Actualizando hoja...</div>}
    </div>
  );
}
