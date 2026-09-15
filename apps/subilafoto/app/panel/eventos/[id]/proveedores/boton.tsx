"use client";

import { useActionState } from "react";
import {
  crearEnlaceDeProveedoresAction,
  type EstadoEnlace,
} from "@/app/actions/proveedores";

export function BotonDeEnlace({ eventoId }: { eventoId: string }) {
  const [estado, accion, creando] = useActionState<EstadoEnlace, FormData>(
    crearEnlaceDeProveedoresAction,
    {},
  );

  return (
    <form action={accion} className="mt-8">
      <input type="hidden" name="eventoId" value={eventoId} />

      {estado.error ? (
        <p role="alert" className="mb-4 text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={creando}
        className="rounded-xl px-7 py-4 font-extrabold text-white disabled:opacity-50"
        style={{ background: "var(--slf-violeta)", minHeight: "44px" }}
      >
        {creando ? "Creando…" : "Crear el enlace"}
      </button>
    </form>
  );
}
