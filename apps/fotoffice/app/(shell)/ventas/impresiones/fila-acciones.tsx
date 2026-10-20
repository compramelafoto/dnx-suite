"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularPreparacionAction } from "../impresion/actions";

/** Imprimir (abre la hoja) y Anular (sólo lo que no se cobró) de una fila de la cola. */
export function FilaAcciones({ preparacionId, hojaId }: { preparacionId: string; hojaId: string | null }) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function anular() {
    if (!confirm("¿Anular esta preparación?")) return;
    setError(null);
    empezar(async () => {
      const r = await anularPreparacionAction(preparacionId);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <span className="flex flex-col items-end gap-1">
      <span className="flex gap-2">
        <button
          type="button"
          className="fo-btn fo-btn-primary text-sm"
          disabled={!hojaId}
          onClick={() => hojaId && window.open(`/imprimir/hoja/${hojaId}`, "_blank")}
        >
          Imprimir
        </button>
        <button type="button" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente} onClick={anular}>
          Anular
        </button>
      </span>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
