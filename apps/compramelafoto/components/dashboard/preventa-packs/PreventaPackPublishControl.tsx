"use client";

import { cn } from "@/lib/utils";

export default function PreventaPackPublishControl({
  isPublished,
  disabled,
  busy,
  onToggle,
}: {
  isPublished: boolean;
  disabled?: boolean;
  busy?: boolean;
  onToggle: () => void;
}) {
  const actionLabel = isPublished ? "Despublicar" : "Publicar";

  return (
    <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[10.5rem]">
      <span
        className={cn(
          "text-xs font-medium px-2 py-0.5 rounded-full w-fit",
          isPublished ? "bg-emerald-50 text-emerald-800" : "bg-[#f3f4f6] text-[#6b7280]"
        )}
      >
        {isPublished ? "Publicado" : "Borrador"}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={isPublished}
        aria-label={actionLabel}
        disabled={disabled || busy}
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-[#e5e7eb] bg-[#fafafa] px-3 py-2 text-left transition-colors",
          "hover:border-[#d1d5db] hover:bg-white",
          (disabled || busy) && "cursor-not-allowed opacity-60"
        )}
      >
        <span className="text-sm font-medium text-[#374151]">{actionLabel}</span>
        <span
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 rounded-full border border-transparent transition-colors",
            isPublished ? "bg-[#c27b3d]" : "bg-[#e5e7eb]"
          )}
          aria-hidden
        >
          <span
            className={cn(
              "pointer-events-none absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              isPublished ? "translate-x-[1.375rem]" : "translate-x-0"
            )}
          />
        </span>
      </button>
      {busy ? <span className="text-xs text-[#6b7280]">Guardando…</span> : null}
    </div>
  );
}
