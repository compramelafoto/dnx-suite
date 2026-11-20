"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { Pencil, X } from "lucide-react";

/**
 * El lápiz al lado del nombre: abre una ventana con todos los datos de la persona para verlos y
 * editarlos (datos, contacto, más datos, socio, personas relacionadas…). El contenido llega armado
 * desde el servidor; acá sólo se abre y se cierra.
 *
 * `abiertaAlInicio`: se abre sola al entrar (por ejemplo, cuando un guardado volvió con error).
 */
export function VentanaEdicion({
  titulo,
  etiqueta = "Editar datos",
  abiertaAlInicio = false,
  children,
}: {
  titulo: string;
  etiqueta?: string;
  abiertaAlInicio?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();

  useEffect(() => {
    if (abiertaAlInicio && ref.current && !ref.current.open) ref.current.showModal();
  }, [abiertaAlInicio]);

  return (
    <>
      <button
        type="button"
        className="fo-icon-btn !size-9"
        data-tip={etiqueta}
        aria-label={etiqueta}
        aria-haspopup="dialog"
        onClick={() => ref.current?.showModal()}
      >
        <Pencil className="size-4" aria-hidden />
      </button>
      <dialog
        ref={ref}
        aria-labelledby={`${id}-titulo`}
        className="m-auto w-[min(64rem,94vw)] max-h-[90vh] overflow-hidden rounded-[var(--fo-radius)] border border-[var(--fo-border)] bg-[var(--fo-bg)] p-0 text-[var(--fo-text)] shadow-2xl backdrop:bg-black/50"
        // Tocar fuera de la ventana la cierra.
        onClick={(ev) => {
          if (ev.target === ref.current) ref.current?.close();
        }}
      >
        <div className="flex max-h-[90vh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-[var(--fo-border)] bg-[var(--fo-surface)] px-5 py-3">
            <h2 id={`${id}-titulo`} className="text-lg font-semibold">
              {titulo}
            </h2>
            <button type="button" className="fo-icon-btn !size-9" aria-label="Cerrar" onClick={() => ref.current?.close()}>
              <X className="size-4" aria-hidden />
            </button>
          </header>
          <div className="overflow-y-auto p-5">{children}</div>
        </div>
      </dialog>
    </>
  );
}
