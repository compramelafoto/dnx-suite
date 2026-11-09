"use client";

import { useActionState } from "react";
import { conectarAgentesAction, correrPeriodistaAction, nuevoEnlaceAgentesAction, type EstadoAccionAgentes } from "./actions";

type Accion = "conectar" | "enlace" | "correr";

const ACCIONES: Record<Accion, () => Promise<EstadoAccionAgentes>> = {
  conectar: conectarAgentesAction,
  enlace: nuevoEnlaceAgentesAction,
  correr: correrPeriodistaAction,
};

/** Un botón que llama a una acción del servidor y muestra el resultado debajo. */
export function BotonAgentes({ accion, texto, variante = "secundario", deshabilitado = false }: { accion: Accion; texto: string; variante?: "primario" | "secundario"; deshabilitado?: boolean }) {
  const [estado, ejecutar, enCurso] = useActionState<EstadoAccionAgentes, FormData>(() => ACCIONES[accion](), null);
  return (
    <form action={ejecutar} className="space-y-2">
      <button type="submit" disabled={enCurso || deshabilitado} className={variante === "primario" ? "fo-btn fo-btn-primary" : "fo-btn fo-btn-secondary"}>
        {enCurso ? "Un momento…" : texto}
      </button>
      {estado ? (
        <div className={estado.ok ? "fo-alert-success" : "fo-alert-error"} role="status">
          {estado.mensaje}
        </div>
      ) : null}
    </form>
  );
}
