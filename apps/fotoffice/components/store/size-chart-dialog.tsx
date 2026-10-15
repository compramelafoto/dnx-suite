"use client";

import { useRef } from "react";
import { X } from "lucide-react";

/** "Ver tabla de talles": abre la imagen que cargó el negocio en un diálogo nativo (Esc cierra). */
export function SizeChartDialog({ imageUrl, productTitle }: { imageUrl: string; productTitle: string }) {
  const dialogo = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogo.current?.showModal()}
        className="text-sm underline underline-offset-4 opacity-80 hover:opacity-100"
      >
        Ver tabla de talles
      </button>
      <dialog
        ref={dialogo}
        aria-label={`Tabla de talles de ${productTitle}`}
        onClick={(e) => {
          // Un clic en el fondo (fuera del contenido) cierra.
          if (e.target === dialogo.current) dialogo.current?.close();
        }}
        className="m-auto w-[calc(100vw-2rem)] max-w-2xl rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-surface)] p-0 text-[var(--fo-text)] backdrop:bg-black/60"
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--fo-border)] px-4 py-3">
          <h2 className="text-sm font-semibold">Tabla de talles</h2>
          <button
            type="button"
            onClick={() => dialogo.current?.close()}
            aria-label="Cerrar"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-[var(--fo-accent-muted)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-auto p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={`Tabla de talles de ${productTitle}`} className="mx-auto block h-auto max-w-full" />
        </div>
      </dialog>
    </>
  );
}
