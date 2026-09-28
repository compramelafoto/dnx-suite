"use client";

import { useState, useTransition } from "react";
import { ETIQUETA_RESULTADO, RESULTADOS, type ResultadoSeguimiento } from "@/lib/sales-assistant/constants";
import { registrarResultadoAction, type PanelState } from "./actions";
import { EstadoPanel } from "./estado-panel";

const inicial: PanelState = { error: null, ok: null };

/**
 * "¿Qué contestó?": los botones rápidos que cierran el hueco de WhatsApp (spec §3.3). Los usan la
 * tarjeta de la bandeja y el detalle, mientras haya un envío sin resultado anotado.
 *
 * Una vez anotado, se esconde: el mensaje de confirmación queda a la vista y la página se refresca
 * sola (la acción revalida `/ventas`).
 */
export function ResultadoBotones({
  opportunityId,
  suggestionId,
}: {
  opportunityId: string;
  suggestionId: string | null;
}) {
  const [respuesta, setRespuesta] = useState("");
  const [anotado, setAnotado] = useState(false);
  const [state, setState] = useState<PanelState>(inicial);
  const [ocupado, startTransition] = useTransition();

  function anotar(outcome: ResultadoSeguimiento) {
    startTransition(async () => {
      const r = await registrarResultadoAction(opportunityId, suggestionId, outcome, respuesta);
      setState(r);
      if (!r.error) setAnotado(true);
    });
  }

  if (anotado) return <EstadoPanel state={state} />;

  return (
    <div className="space-y-3 rounded-lg border border-[var(--fo-border)] p-3">
      <p className="text-sm font-medium">¿Qué contestó?</p>
      <label className="fo-field-stack">
        <span className="fo-label">¿Qué respondió? (opcional)</span>
        <input
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          maxLength={2000}
          className="fo-input text-base sm:text-sm"
        />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
        {RESULTADOS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => anotar(r)}
            disabled={ocupado}
            className="fo-btn fo-btn-secondary min-h-11"
          >
            {ETIQUETA_RESULTADO[r]}
          </button>
        ))}
      </div>
      <EstadoPanel state={state} />
    </div>
  );
}
