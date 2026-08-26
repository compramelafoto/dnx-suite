"use client";

import { useState, useTransition } from "react";
import { advanceCardFulfillmentAction } from "@/app/actions/card-fulfillment";
import { stateLabel, type FulfillmentState } from "@/lib/carnet/fulfillment";

/**
 * Un paso del recorrido.
 *
 * Los estados que exigen explicación —anular y despachar— muestran el campo de nota antes de
 * confirmar, en vez de rechazar después: pedir el motivo cuando ya se apretó el botón hace
 * que la gente escriba cualquier cosa para salir del paso.
 */
export function AdvanceForm({
  cardId,
  options,
}: {
  cardId: string;
  options: FulfillmentState[];
}) {
  const [destino, setDestino] = useState<FulfillmentState | null>(null);
  const [nota, setNota] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const pideNota = destino === "ANULADO" || destino === "ENVIADO";

  function confirmar(estado: FulfillmentState) {
    setError(null);
    startTransition(async () => {
      const data = new FormData();
      data.set("cardId", cardId);
      data.set("toState", estado);
      data.set("note", nota);
      const r = await advanceCardFulfillmentAction(data);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDestino(null);
      setNota("");
    });
  }

  if (options.length === 0) {
    return <span className="text-xs text-[var(--fo-muted-soft)]">Sin pasos disponibles</span>;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((estado) => (
          <button
            key={estado}
            type="button"
            disabled={pendiente}
            onClick={() => {
              if (estado === "ANULADO" || estado === "ENVIADO") {
                setDestino(estado === destino ? null : estado);
                return;
              }
              confirmar(estado);
            }}
            className={`fo-btn text-xs disabled:opacity-60 ${
              destino === estado ? "fo-btn-primary" : ""
            }`}
          >
            {stateLabel(estado)}
          </button>
        ))}
      </div>

      {pideNota && destino ? (
        <div className="space-y-1.5">
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder={
              destino === "ANULADO"
                ? "Por qué se anula"
                : "Cómo se despachó: correo, número de seguimiento o quién lo llevó"
            }
            className="fo-input w-full text-xs"
          />
          <button
            type="button"
            disabled={pendiente || !nota.trim()}
            onClick={() => confirmar(destino)}
            className="fo-btn fo-btn-primary text-xs disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : `Confirmar ${stateLabel(destino).toLowerCase()}`}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
