"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Visor a pantalla completa, común a la galería de la portada y a la de cada ficha. Escape
 * cierra, las flechas pasan de foto. Al cerrar, el foco vuelve a la miniatura que lo abrió.
 * La foto la pone quien lo usa (`children`): así cada galería elige cómo cargarla.
 */
export function Visor({ etiqueta, pie, onCerrar, onIr, children }: {
  etiqueta: string;
  pie?: ReactNode;
  onCerrar: () => void;
  onIr: (paso: number) => void;
  children: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const desborde = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    caja.current?.focus();
    return () => {
      document.body.style.overflow = desborde;
      previo?.focus?.();
    };
  }, []);

  const boton = "px-1 py-1 text-sm text-white/75 underline-offset-4 hover:text-white hover:underline";

  return (
    <div
      ref={caja}
      role="dialog"
      aria-modal="true"
      aria-label={etiqueta}
      tabIndex={-1}
      className="mf-sobre-foto fixed inset-0 z-50 flex flex-col bg-[#0f171d] text-white outline-none"
      onKeyDown={(e) => {
        if (e.key === "Escape") onCerrar();
        if (e.key === "ArrowRight") onIr(1);
        if (e.key === "ArrowLeft") onIr(-1);
      }}
    >
      <div className="flex justify-end px-4 py-3 sm:px-6">
        <button type="button" className={boton} onClick={onCerrar}>Cerrar</button>
      </div>
      <div className="relative min-h-0 flex-1 px-4 sm:px-16">{children}</div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <div className="min-w-0 text-sm text-white/85">{pie}</div>
        <div className="flex gap-5">
          <button type="button" className={boton} onClick={() => onIr(-1)}>Anterior</button>
          <button type="button" className={boton} onClick={() => onIr(1)}>Siguiente</button>
        </div>
      </div>
    </div>
  );
}
