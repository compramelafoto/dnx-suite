"use client";

import { useEffect } from "react";

export type FlashToastTone = "success" | "error";

type FlashToastProps = {
  message: string;
  tone?: FlashToastTone;
  onDismiss: () => void;
  durationMs?: number;
};

export default function FlashToast({
  message,
  tone = "success",
  onDismiss,
  durationMs = 4000,
}: FlashToastProps) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, durationMs);
    return () => window.clearTimeout(t);
  }, [message, durationMs, onDismiss]);

  const bg = tone === "success" ? "bg-[#10b981]" : "bg-[#ef4444]";

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] animate-in fade-in slide-in-from-bottom-2 duration-300"
      role="status"
      aria-live="polite"
    >
      <div
        className={`${bg} text-white rounded-lg shadow-lg px-4 py-3 flex items-center gap-2 min-w-[200px] max-w-[min(100vw-2rem,24rem)]`}
      >
        <p className="text-sm font-medium m-0">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-auto shrink-0 text-white/90 hover:text-white text-lg leading-none"
          aria-label="Cerrar"
        >
          ×
        </button>
      </div>
    </div>
  );
}
