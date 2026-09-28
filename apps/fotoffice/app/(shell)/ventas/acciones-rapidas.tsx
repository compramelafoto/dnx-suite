"use client";

import { useState, useTransition } from "react";
import { actualizarAhoraAction, archivarAction, reanalizarAction, type PanelState } from "./actions";
import { EstadoPanel } from "./estado-panel";

const inicial: PanelState = { error: null, ok: null };

/**
 * Los botones que disparan una acción sin formulario: "Actualizar ahora" en la bandeja y
 * "Volver a analizar" / "Archivar" en el detalle.
 *
 * Una corrida puede tardar un par de minutos (lee Alboom y le pregunta a Claude), así que el
 * botón avisa que está trabajando y no se puede volver a apretar mientras tanto.
 */
function useAccion() {
  const [state, setState] = useState<PanelState>(inicial);
  const [ocupado, startTransition] = useTransition();
  const correr = (accion: () => Promise<PanelState>) =>
    startTransition(async () => {
      setState(await accion());
    });
  return { state, ocupado, correr };
}

export function ActualizarAhora() {
  const { state, ocupado, correr } = useAccion();
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => correr(actualizarAhoraAction)}
        disabled={ocupado}
        className="fo-btn fo-btn-primary min-h-11 w-full sm:w-auto"
      >
        {ocupado ? "Actualizando… (puede tardar un par de minutos)" : "Actualizar ahora"}
      </button>
      <EstadoPanel state={state} />
    </div>
  );
}

export function AccionesDetalle({ opportunityId, archivada }: { opportunityId: string; archivada: boolean }) {
  const { state, ocupado, correr } = useAccion();
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={() => correr(() => reanalizarAction(opportunityId))}
          disabled={ocupado}
          className="fo-btn fo-btn-primary min-h-11"
        >
          {ocupado ? "Trabajando…" : "Volver a analizar"}
        </button>
        <button
          type="button"
          onClick={() => correr(() => archivarAction(opportunityId, !archivada))}
          disabled={ocupado}
          className="fo-btn fo-btn-secondary min-h-11"
        >
          {archivada ? "Desarchivar" : "Archivar en el asistente"}
        </button>
      </div>
      <EstadoPanel state={state} />
    </div>
  );
}
