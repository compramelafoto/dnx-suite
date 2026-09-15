"use client";

import { useState, useTransition } from "react";
import { issueDigitalCardsAction } from "@/app/actions/issue-cards";

/** Emite los carnets digitales que falten. Correrlo de más no duplica nada. */
export function IssueButton() {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            setMensaje(null);
            const r = await issueDigitalCardsAction();
            if (!r.ok) {
              setError(r.error);
              return;
            }
            // Reformulado para no depender del género: "socios activos" hacía concordar el
            // adjetivo en masculino con la palabra que configure cada workspace. "Padrón" es
            // un concepto fijo, no la palabra configurada, así que no tiene ese problema.
            setMensaje(
              r.emitidos === 0
                ? `Todo el padrón activo ya tenía carnet (${r.yaTenian}).`
                : `Se emitieron ${r.emitidos} carnets. Ya tenían: ${r.yaTenian}.`,
            );
          })
        }
        className="fo-btn text-xs disabled:opacity-60"
      >
        {pendiente ? "Emitiendo…" : "Emitir carnets digitales que falten"}
      </button>
      {mensaje ? <p className="text-xs text-[var(--fo-success)]">{mensaje}</p> : null}
      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
