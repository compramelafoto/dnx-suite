"use client";

import { useActionState } from "react";
import { probarConexionAction, type EstadoPrueba } from "./actions";

/** «Probar conexión»: muestra cada paso con su resultado, sin salir de la pantalla. */
export function ProbarConexion({ environment, habilitado }: { environment: string; habilitado: boolean }) {
  const [estado, accion, pendiente] = useActionState<EstadoPrueba | undefined, FormData>(probarConexionAction, undefined);
  return (
    <form action={accion} className="space-y-3">
      <input type="hidden" name="environment" value={environment} />
      <button type="submit" className="fo-btn fo-btn-secondary text-sm" disabled={!habilitado || pendiente}>
        {pendiente ? "Probando…" : "Probar conexión"}
      </button>
      {estado?.error ? <p className="text-sm text-[var(--fo-danger)]">{estado.error}</p> : null}
      {estado?.resultado ? (
        <ul className="space-y-1 text-sm">
          {estado.resultado.pasos.map((p) => (
            <li key={p.nombre} className={p.ok ? "text-[var(--fo-success)]" : "text-[var(--fo-danger)]"}>
              {p.ok ? "✓" : "✗"} {p.nombre}
              <span className="block pl-5 text-xs text-[var(--fo-muted)]">{p.detalle}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  );
}
