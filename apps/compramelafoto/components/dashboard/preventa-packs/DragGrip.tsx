"use client";

import type { DragEvent } from "react";

export default function DragGrip({
  disabled,
  onDragStart,
  onDragEnd,
}: {
  disabled?: boolean;
  onDragStart?: (e: DragEvent<HTMLButtonElement>) => void;
  onDragEnd?: (e: DragEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      draggable={!disabled}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      disabled={disabled}
      className="shrink-0 p-1 rounded text-[#9ca3af] hover:text-[#374151] hover:bg-[#f3f4f6] cursor-grab active:cursor-grabbing disabled:opacity-40 disabled:cursor-not-allowed touch-none"
      aria-label="Arrastrar para reordenar"
    >
      <span className="block text-base leading-none select-none font-mono tracking-tighter" aria-hidden>
        ⋮⋮
      </span>
    </button>
  );
}
