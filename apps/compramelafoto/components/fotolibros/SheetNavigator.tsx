"use client";

import { memo } from "react";

type SheetNavigatorProps = {
  currentIndex: number; // 0-based
  totalSheets: number;
  onPrev: () => void;
  onNext: () => void;
};

function SheetNavigator({ currentIndex, totalSheets, onPrev, onNext }: SheetNavigatorProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentIndex <= 0}
        className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1.5 text-sm text-[#1a1a1a] disabled:opacity-50 hover:bg-[#f9fafb]"
        aria-label="Hoja anterior"
      >
        ←
      </button>
      <span className="min-w-[80px] text-center text-sm font-medium text-[#1a1a1a]">
        Hoja {currentIndex + 1} de {totalSheets}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={currentIndex >= totalSheets - 1 || totalSheets === 0}
        className="rounded-md border border-[#e5e7eb] bg-white px-2 py-1.5 text-sm text-[#1a1a1a] disabled:opacity-50 hover:bg-[#f9fafb]"
        aria-label="Hoja siguiente"
      >
        →
      </button>
    </div>
  );
}

export default memo(SheetNavigator);
