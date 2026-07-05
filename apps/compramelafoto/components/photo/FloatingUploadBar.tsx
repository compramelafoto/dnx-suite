"use client";

import { useUploadProgress } from "@/contexts/UploadProgressContext";

export default function FloatingUploadBar() {
  const ctx = useUploadProgress();
  if (!ctx) return null;

  const { state } = ctx;
  if (!state.uploading || state.total === 0) return null;

  const percent = Math.min(
    100,
    Math.round((state.progressRatio > 0 ? state.progressRatio : state.done / state.total) * 100)
  );

  return (
    <div
      className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 w-[min(100vw-2rem,320px)] rounded-xl border-2 border-[#c27b3d]/30 bg-white shadow-xl p-3"
      role="status"
      aria-live="polite"
      aria-label={`Subiendo fotos: ${state.done} de ${state.total}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-slate-800 truncate">
          {state.albumTitle ? `${state.albumTitle} — ` : ""}Subiendo fotos
        </span>
        <span className="text-xs font-semibold text-[#c27b3d] shrink-0 tabular-nums">
          {percent}%
        </span>
      </div>
      <div className="h-2.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-[#c27b3d] transition-all duration-500 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-slate-600 m-0 tabular-nums">
        {state.done.toLocaleString("es-AR")} / {state.total.toLocaleString("es-AR")}
        {state.failed > 0 ? ` · ${state.failed} error${state.failed !== 1 ? "es" : ""}` : ""}
      </p>
      <p className="text-[11px] text-amber-800 m-0 font-medium">
        No cierres esta pestaña
      </p>
    </div>
  );
}
