"use client";

import { useUploadProgress } from "@/contexts/UploadProgressContext";

export default function FloatingUploadBar() {
  const ctx = useUploadProgress();
  if (!ctx) return null;

  const { state } = ctx;
  if (!state.uploading || state.total === 0) return null;

  const percent = Math.min(100, Math.round((state.done / state.total) * 100));

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-[280px] rounded-xl border-2 border-slate-200 bg-white shadow-xl p-3"
      role="status"
      aria-live="polite"
      aria-label={`Subiendo fotos: ${state.done} de ${state.total}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800 truncate">
          {state.albumTitle ? `${state.albumTitle} — ` : ""}Subiendo fotos
        </span>
        <span className="text-xs font-semibold text-slate-600 shrink-0">
          {state.done}/{state.total}
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#c27b3d] transition-all duration-300 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
