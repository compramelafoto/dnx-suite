"use client";

import { useEffect, useState } from "react";
import type { PolaroidItem } from "./export";
import { renderPolaroidToCanvas } from "./export";
import type { PolaroidPreset } from "./presets";

type PreviewEntry = {
  id: string;
  url: string;
};

export default function PolaroidPreviewList({
  items,
  preset,
  activeId,
  onSelect,
}: {
  items: PolaroidItem[];
  preset: PolaroidPreset;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const [previews, setPreviews] = useState<PreviewEntry[]>([]);

  useEffect(() => {
    let active = true;
    async function build() {
      const next: PreviewEntry[] = [];
      for (const item of items) {
        const canvas = await renderPolaroidToCanvas(item, preset, 120);
        next.push({ id: item.id, url: canvas.toDataURL("image/png") });
      }
      if (active) setPreviews(next);
    }
    build();
    return () => {
      active = false;
    };
  }, [items, preset]);

  if (!items.length) return null;

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium text-[#1a1a1a]">Polaroids</div>
      <div className="space-y-3">
        {previews.map((preview) => (
          <button
            key={preview.id}
            type="button"
            onClick={() => onSelect(preview.id)}
            className={`w-full rounded-xl border p-2 text-left transition ${
              activeId === preview.id
                ? "border-[#c27b3d] ring-2 ring-[#c27b3d]/20"
                : "border-[#e5e7eb]"
            }`}
          >
            <img src={preview.url} alt="Polaroid preview" className="w-full rounded-lg" />
          </button>
        ))}
      </div>
    </div>
  );
}
