"use client";

import { useState, useCallback, memo } from "react";
import type { Spread } from "./types";
import Card from "@/components/ui/Card";

type SpreadButtonProps = {
  spread: Spread;
  index: number;
  isActive: boolean;
  onSelect: (id: string) => void;
  onDragStart: (id: string) => void;
  onDrop: (id: string) => void;
};

const SpreadButton = memo(function SpreadButton({
  spread,
  index,
  isActive,
  onSelect,
  onDragStart,
  onDrop,
}: SpreadButtonProps) {
  return (
    <button
      type="button"
      draggable
      onDragStart={() => onDragStart(spread.id)}
      onDragOver={(e) => e.preventDefault()}
      onDrop={() => onDrop(spread.id)}
      onClick={() => onSelect(spread.id)}
      className={`min-w-[140px] rounded-md border px-3 py-2 text-left text-xs ${
        isActive ? "border-[#c27b3d] bg-[#fff7ee]" : "border-[#e5e7eb] bg-white"
      }`}
    >
      <div className="flex items-center justify-between">
        <span>Hoja {index + 1}</span>
        <span className="text-[10px] text-[#6b7280]">{spread.items.length} items</span>
      </div>
    </button>
  );
});

type TimelineProps = {
  spreads: Spread[];
  activeId: string;
  onSelect: (id: string) => void;
  onReorder: (next: Spread[]) => void;
};

function Timeline({ spreads, activeId, onSelect, onReorder }: TimelineProps) {
  const [dragId, setDragId] = useState<string | null>(null);

  const handleDrop = useCallback(
    (targetId: string) => {
      if (!dragId || dragId === targetId) return;
      const next = [...spreads];
      const fromIndex = next.findIndex((spread) => spread.id === dragId);
      const toIndex = next.findIndex((spread) => spread.id === targetId);
      if (fromIndex === -1 || toIndex === -1) return;
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      onReorder(next);
      setDragId(null);
    },
    [dragId, spreads, onReorder]
  );

  return (
    <Card className="p-3 space-y-2">
      <div className="text-xs font-medium text-[#1a1a1a]">Hojas</div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {spreads.map((spread, index) => (
          <SpreadButton
            key={spread.id}
            spread={spread}
            index={index}
            isActive={spread.id === activeId}
            onSelect={onSelect}
            onDragStart={setDragId}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </Card>
  );
}

export default memo(Timeline);
