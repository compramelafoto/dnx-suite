"use client";

import { useEffect } from "react";

export type CatalogTemplatesToastTone = "success" | "info";

type CatalogTemplatesToastProps = {
  message: string;
  tone?: CatalogTemplatesToastTone;
  onDismiss: () => void;
  durationMs?: number;
};

export default function CatalogTemplatesToast({
  message,
  tone = "success",
  onDismiss,
  durationMs = 4500,
}: CatalogTemplatesToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [onDismiss, durationMs, message]);

  const toneClass =
    tone === "success"
      ? "bg-[#1a1a1a] text-white border-[#374151]"
      : "bg-white text-[#1a1a1a] border-[#e5e7eb]";

  return (
    <div
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300"
      role="status"
      aria-live="polite"
    >
      <div
        className={`rounded-xl border shadow-lg px-4 py-3.5 flex items-start gap-3 ${toneClass}`}
      >
        {tone === "success" ? (
          <svg
            className="w-5 h-5 flex-shrink-0 mt-0.5 text-[#86efac]"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        ) : null}
        <p className="text-sm font-medium leading-relaxed m-0 flex-1 min-w-0">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className={`shrink-0 text-xs font-medium underline-offset-2 hover:underline ${
            tone === "success" ? "text-white/80" : "text-[#6b7280]"
          }`}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
