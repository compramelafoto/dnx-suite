"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularPreparacionAction } from "../impresion/actions";

/** Imprimir (abre la hoja) y Anular (sólo lo que no se cobró: lo cobrado se libera anulando la venta). */
export function FilaAcciones({
  preparacionId,
  hojaId,
  hojaVersion,
  cobrada,
}: {
  preparacionId: string;
  hojaId: string | null;
  hojaVersion: string | null;
  cobrada: boolean;
}) {
  const router = useRouter();
  const [pendiente, empezar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function anular() {
    if (!confirm("¿Anular esta preparación?")) return;
    setError(null);
    empezar(async () => {
      try {
        const r = await anularPreparacionAction(preparacionId);
        if (!r.ok) {
          setError(r.error);
          return;
        }
      } catch {
        setError("No se pudo anular. Revisá la conexión y probá de nuevo.");
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
          onClick={() => hojaId && window.open(`/imprimir/hoja/${hojaId}?v=${hojaVersion ?? "0"}`, "_blank")}
        >
          Imprimir
        </button>
        {cobrada ? null : (
          <button type="button" className="fo-btn fo-btn-danger-outline text-sm" disabled={pendiente} onClick={anular}>
            Anular
          </button>
        )}
      </span>
      {error ? <span role="alert" className="text-xs text-red-700">{error}</span> : null}
    </span>
  );
}
