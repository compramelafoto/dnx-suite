"use client";

import { useEffect, useRef } from "react";

/** Confirma el cierre como ganada: no se puede deshacer. Esc o Cancelar vuelven sin cambios. */
export function DialogoGanada({
  titulo,
  onConfirmar,
  onCancelar,
}: {
  /** Nombre de la consulta; null = el diálogo está cerrado. */
  titulo: string | null;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const abierto = titulo !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    else if (!abierto && d.open) d.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialogo-ganada-titulo"
      className="fo-card w-[90vw] max-w-md p-0 backdrop:bg-black/50"
      onClose={() => {
        if (abierto) onCancelar();
      }}
    >
      <form
        className="space-y-4 p-6"
        onSubmit={(ev) => {
          ev.preventDefault();
          onConfirmar();
        }}
      >
        <div className="space-y-1">
          <h2 id="dialogo-ganada-titulo" className="text-lg font-semibold text-[var(--fo-text)]">
            ¿Marcar como ganada? No se puede deshacer.
          </h2>
          {titulo ? <p className="text-sm text-[var(--fo-muted)]">{titulo}</p> : null}
        </div>
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className="fo-btn fo-btn-primary text-sm">
            Confirmar
          </button>
        </div>
      </form>
    </dialog>
  );
}
