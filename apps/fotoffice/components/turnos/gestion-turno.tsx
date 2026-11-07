"use client";

import { useActionState, useState } from "react";
import { cancelarTurnoAction, reprogramarTurnoAction, type EstadoAccionTurno } from "@/app/w/[workspaceSlug]/turnos/actions";
import type { DiaConHorarios } from "@/lib/turnos/disponibilidad";
import { SelectorHorario } from "./selector-horario";

const INICIAL: EstadoAccionTurno = { error: null };

function Aviso({ error }: { error: string | null }) {
  return error ? (
    <p className="fo-alert-error rounded-[var(--fo-radius-sm)] p-3 text-sm text-[var(--fo-danger)]" role="alert">
      {error}
    </p>
  ) : null;
}

/** Reprogramar (elegir otro horario del mismo tipo) o cancelar el turno. */
export function GestionTurno({ workspaceSlug, token, dias }: { workspaceSlug: string; token: string; dias: DiaConHorarios[] | null }) {
  const [modo, setModo] = useState<"nada" | "reprogramar" | "cancelar">("nada");
  const [inicio, setInicio] = useState<string | null>(null);
  const [estadoR, reprogramar, pendienteR] = useActionState(reprogramarTurnoAction, INICIAL);
  const [estadoC, cancelar, pendienteC] = useActionState(cancelarTurnoAction, INICIAL);

  if (modo === "reprogramar") {
    return (
      <form action={reprogramar} className="fo-card space-y-4 p-5">
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        <input type="hidden" name="token" value={token} />
        {dias && dias.length > 0 ? (
          <SelectorHorario dias={dias} onElegir={setInicio} />
        ) : (
          <p className="text-sm text-[var(--fo-muted)]">No hay otros horarios libres por ahora. Escribinos y lo vemos.</p>
        )}
        <Aviso error={estadoR.error} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="fo-btn fo-btn-primary" disabled={pendienteR || !inicio}>
            {pendienteR ? "Guardando…" : "Pasar a este horario"}
          </button>
          <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setModo("nada")}>
            Volver
          </button>
        </div>
      </form>
    );
  }

  if (modo === "cancelar") {
    return (
      <form action={cancelar} className="fo-card space-y-4 p-5">
        <input type="hidden" name="workspaceSlug" value={workspaceSlug} />
        <input type="hidden" name="token" value={token} />
        <p className="text-sm">¿Seguro que querés cancelar el turno? El horario queda libre para otra persona.</p>
        <Aviso error={estadoC.error} />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="fo-btn fo-btn-danger" disabled={pendienteC}>
            {pendienteC ? "Cancelando…" : "Sí, cancelar el turno"}
          </button>
          <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setModo("nada")}>
            No, volver
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" className="fo-btn fo-btn-secondary" onClick={() => setModo("reprogramar")}>
        Cambiar el horario
      </button>
      <button type="button" className="fo-btn fo-btn-ghost" onClick={() => setModo("cancelar")}>
        Cancelar el turno
      </button>
    </div>
  );
}
