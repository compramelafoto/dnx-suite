"use client";

import { useActionState } from "react";
import {
  deshacerEnvioBoxAction,
  marcarBoxEntregadaAction,
  type BoxActionState,
} from "@/app/actions/box-mensual";

const initial: BoxActionState = { error: null, ok: null };

/** Acciones de un envío que todavía no figura entregado: marcarlo entregado o deshacerlo. */
export function EnvioAcciones({ shipmentId }: { shipmentId: string }) {
  const [entregada, entregar, entregando] = useActionState(marcarBoxEntregadaAction, initial);
  const [deshecho, deshacer, deshaciendo] = useActionState(deshacerEnvioBoxAction, initial);
  const error = entregada.error ?? deshecho.error;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <form action={entregar}>
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <button type="submit" disabled={entregando || deshaciendo} className="fo-btn fo-btn-secondary text-xs disabled:opacity-60">
          {entregando ? "Guardando…" : "Marcar entregada"}
        </button>
      </form>
      <form
        action={deshacer}
        onSubmit={(e) => {
          if (!window.confirm("¿Deshacer este envío? La caja vuelve a quedar pendiente para esta persona.")) {
            e.preventDefault();
          }
        }}
      >
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <button type="submit" disabled={entregando || deshaciendo} className="fo-btn fo-btn-ghost text-xs disabled:opacity-60">
          {deshaciendo ? "Deshaciendo…" : "Deshacer"}
        </button>
      </form>
      {error ? (
        <p className="w-full text-right text-xs text-[var(--fo-danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
