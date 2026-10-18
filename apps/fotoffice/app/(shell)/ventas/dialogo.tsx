"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * Ventana emergente del mostrador. Lleva `data-mostrador-modal` para que los atajos de teclado
 * del mostrador (Esc vacía el ticket, + suma, etc.) no se disparen mientras está abierta.
 */
export function Dialogo({ titulo, onCerrar, children }: { titulo: string; onCerrar: () => void; children: ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const anterior = document.activeElement as HTMLElement | null;
    // El cursor arranca en el primer campo para escribir, no en la "X" de cerrar.
    const primero =
      caja.current?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea") ??
      caja.current?.querySelector<HTMLElement>("button");
    primero?.focus();
    return () => anterior?.focus?.();
  }, []);

  return (
    <div
      data-mostrador-modal
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          onCerrar();
        }
      }}
    >
      <div
        ref={caja}
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className="w-full max-w-md rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg-elevated)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--fo-border)] px-5 py-3">
          <h2 className="text-base font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            className="flex size-8 items-center justify-center rounded-full text-[var(--fo-muted)] hover:bg-[var(--fo-surface-hover)]"
            aria-label="Cerrar"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
