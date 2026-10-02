"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Pide el motivo (obligatorio) y una nota opcional antes de cerrar una consulta como perdida. */
export function DialogoPerdida({
  titulo,
  motivos,
  onConfirmar,
  onCancelar,
}: {
  /** Nombre de la consulta; null = el diálogo está cerrado. */
  titulo: string | null;
  motivos: { id: string; nombre: string }[];
  onConfirmar: (motivoId: string, nota: string) => void;
  onCancelar: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [motivo, setMotivo] = useState("");
  const [nota, setNota] = useState("");
  const abierto = titulo !== null;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
    } else if (!abierto && d.open) {
      d.close();
    }
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialogo-perdida-titulo"
      className="fo-card w-[90vw] max-w-md p-0 backdrop:bg-black/50"
      // Esc o cerrar desde el navegador: vuelve al tablero sin cambios.
      onClose={() => {
        // Cada apertura empieza en blanco.
        setMotivo("");
        setNota("");
        if (abierto) onCancelar();
      }}
    >
      <form
        className="space-y-4 p-6"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (motivo) onConfirmar(motivo, nota.trim());
        }}
      >
        <div className="space-y-1">
          <h2 id="dialogo-perdida-titulo" className="text-lg font-semibold text-[var(--fo-text)]">
            Marcar como perdida
          </h2>
          {titulo ? <p className="text-sm text-[var(--fo-muted)]">{titulo}</p> : null}
        </div>

        {motivos.length === 0 ? (
          <p className="text-sm text-[var(--fo-muted)]">
            No hay motivos de pérdida activos.{" "}
            <Link href="/workspace/configuracion/circuitos" className="text-[var(--fo-accent)] hover:underline">
              Configurá los motivos
            </Link>
            .
          </p>
        ) : (
          <div className="fo-field-stack">
            <label className="fo-label" htmlFor="perdida-motivo">
              Motivo
            </label>
            <select id="perdida-motivo" className="fo-input" required value={motivo} onChange={(ev) => setMotivo(ev.target.value)}>
              <option value="">Elegí un motivo</option>
              {motivos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="fo-field-stack">
          <label className="fo-label" htmlFor="perdida-nota">
            Nota (opcional)
          </label>
          <textarea id="perdida-nota" className="fo-input" rows={3} maxLength={2000} value={nota} onChange={(ev) => setNota(ev.target.value)} />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="fo-btn fo-btn-secondary text-sm" onClick={onCancelar}>
            Cancelar
          </button>
          <button type="submit" className="fo-btn fo-btn-danger text-sm" disabled={!motivo}>
            Marcar como perdida
          </button>
        </div>
      </form>
    </dialog>
  );
}
