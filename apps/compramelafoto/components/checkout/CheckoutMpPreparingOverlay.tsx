"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type CheckoutMpPreparingStep = 1 | 2;

type Props = {
  open: boolean;
  step: CheckoutMpPreparingStep;
};

/** Ancho cómodo en móvil y desktop (patrón AppModal). */
const PANEL_WIDTH = "min(calc(100vw - 2rem), 36rem)";

export default function CheckoutMpPreparingOverlay({ open, step }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!open || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[200] overflow-y-auto overscroll-contain" role="presentation">
      <div className="fixed inset-0 bg-[#111827]/40 backdrop-blur-[2px]" aria-hidden />
      <div className="relative z-[1] flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={cn(
            "box-border shrink-0 rounded-2xl border border-[#ebe8e4] bg-white",
            "px-5 py-6 sm:px-8 sm:py-8",
            "shadow-[0_18px_40px_rgba(17,24,39,0.12)]"
          )}
          style={{ width: PANEL_WIDTH }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="mp-preparing-title"
          aria-busy="true"
        >
          <div className="flex w-full flex-col items-center gap-6 text-center">
            <div
              className="h-12 w-12 shrink-0 rounded-full border-[3px] border-[#c27b3d]/25 border-t-[#c27b3d] animate-spin sm:h-14 sm:w-14"
              aria-hidden
            />

            <div className="w-full space-y-2">
              <h2
                id="mp-preparing-title"
                className="text-xl font-semibold text-[#111827] sm:text-2xl leading-snug"
              >
                Estamos preparando tu pago
              </h2>
              <p className="text-base text-[#4b5563] leading-relaxed sm:text-lg">
                Guardamos tu pedido y te estamos llevando a Mercado Pago.
              </p>
              <p className="text-sm text-[#6b7280]">No cierres esta ventana.</p>
            </div>

            <div className="w-full rounded-xl border border-[#e5e7eb] bg-[#f9fafb] px-4 py-4 text-left sm:px-5 sm:py-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#6b7280]">
                Progreso
              </p>
              <ol className="w-full space-y-3 text-sm text-[#374151] sm:text-base" aria-live="polite">
                <li className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8",
                      step >= 1 ? "bg-emerald-100 text-emerald-800" : "bg-[#f3f4f6] text-[#9ca3af]"
                    )}
                    aria-hidden
                  >
                    {step >= 1 ? "✓" : "1"}
                  </span>
                  <span className={step >= 1 ? "font-medium text-[#111827]" : ""}>Pedido guardado</span>
                </li>
                <li className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold sm:h-8 sm:w-8",
                      step >= 2 ? "bg-[#c27b3d]/15 text-[#9a5f2e]" : "bg-[#f3f4f6] text-[#9ca3af]"
                    )}
                    aria-hidden
                  >
                    {step >= 2 ? "…" : "2"}
                  </span>
                  <span className={step >= 2 ? "font-medium text-[#111827]" : ""}>
                    Conectando con Mercado Pago
                  </span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
