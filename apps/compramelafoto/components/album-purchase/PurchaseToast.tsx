"use client";

import { createPortal } from "react-dom";
import { useEffect } from "react";

export type PurchaseToastTone = "success" | "error" | "info";

export type PurchaseToastState = {
  message: string;
  tone?: PurchaseToastTone;
} | null;

type PurchaseToastProps = {
  toast: PurchaseToastState;
  onDismiss: () => void;
};

const toneStyles: Record<PurchaseToastTone, string> = {
  success: "bg-emerald-900 text-white border-emerald-700",
  error: "bg-red-900 text-white border-red-700",
  info: "bg-[#1a1a1a] text-white border-[#374151]",
};

export default function PurchaseToast({ toast, onDismiss }: PurchaseToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(onDismiss, 4200);
    return () => window.clearTimeout(timer);
  }, [toast, onDismiss]);

  if (!toast || typeof document === "undefined") return null;

  const tone = toast.tone ?? "success";

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed z-[70] box-border pointer-events-none"
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 12px)",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(calc(100vw - 32px), 28rem)",
      }}
    >
      <div
        className={`pointer-events-auto box-border flex w-full min-w-[min(100%,260px)] items-start gap-3 rounded-2xl border px-4 py-3.5 shadow-xl ${toneStyles[tone]}`}
      >
        <p className="min-w-0 flex-1 text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">
          {toast.message}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-0.5 shrink-0 rounded-md p-1 text-sm opacity-80 hover:opacity-100"
          aria-label="Cerrar aviso"
        >
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
}
