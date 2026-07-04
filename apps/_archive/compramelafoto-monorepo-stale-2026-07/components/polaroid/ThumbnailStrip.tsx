"use client";

import { useEffect, useState } from "react";
import type { PolaroidItem } from "./export";
import { renderPolaroidToCanvas } from "./export";
import { POLAROID_PRESETS } from "./presets";

type PreviewEntry = {
  id: string;
  url: string;
  aspectRatio: string;
};

export default function ThumbnailStrip({
  items,
  activeId,
  selectedIds,
  onSelect,
  onToggleSelect,
  onRemove,
}: {
  items: PolaroidItem[];
  activeId: string | null;
  selectedIds: string[];
  onSelect: (id: string) => void;
  onToggleSelect: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [previews, setPreviews] = useState<PreviewEntry[]>([]);

  useEffect(() => {
    let active = true;
    async function build() {
      const next: PreviewEntry[] = [];
      for (const item of items) {
        const preset = POLAROID_PRESETS.find((p) => p.id === item.presetId) ?? POLAROID_PRESETS[0];
        const canvas = await renderPolaroidToCanvas(item, preset, 180);
        next.push({
          id: item.id,
          url: canvas.toDataURL("image/png"),
          aspectRatio: `${preset.widthCm} / ${preset.heightCm}`,
        });
      }
      if (active) setPreviews(next);
    }
    if (items.length > 0) build();
    return () => {
      active = false;
    };
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="flex gap-4 overflow-x-auto py-2 justify-center">
      {previews.map((preview) => {
        const isSelected = selectedIds.includes(preview.id);
        return (
          <div key={preview.id} className="w-[150px] flex-shrink-0 space-y-2">
            <button
              type="button"
              onClick={() => onSelect(preview.id)}
              className={`relative w-full rounded-xl border-2 overflow-hidden bg-white ${
                activeId === preview.id ? "border-[#c27b3d] ring-2 ring-[#c27b3d]/30" : "border-[#e5e7eb]"
              }`}
              style={{ aspectRatio: preview.aspectRatio }}
            >
              <img src={preview.url} alt="Miniatura" className="h-full w-full object-contain" />
              <span className="absolute right-1 top-1">
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleSelect(preview.id);
                  }}
                  className={`h-5 w-5 rounded-full border text-[10px] flex items-center justify-center ${
                    isSelected ? "bg-[#c27b3d] border-[#c27b3d] text-white" : "bg-white border-[#e5e7eb] text-[#9ca3af]"
                  }`}
                  aria-label={isSelected ? "Quitar selección" : "Seleccionar"}
                >
                  ✓
                </button>
              </span>
            </button>
            <button
              type="button"
              onClick={() => onRemove(preview.id)}
              className="w-full rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
              aria-label="Eliminar foto"
            >
              ✕ Eliminar
            </button>
          </div>
      )})}
    </div>
  );
}
