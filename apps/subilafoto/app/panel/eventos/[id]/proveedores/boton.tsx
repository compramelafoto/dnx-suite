"use client";

import { useActionState } from "react";
import {
  crearEnlaceDeCategoriaAction,
  crearEnlaceDeProveedoresAction,
  type EstadoEnlace,
} from "@/app/actions/proveedores";
import { CATEGORIAS } from "@/lib/proveedores/categorias";

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

/**
 * Genera un enlace para un rubro concreto.
 *
 * Se ofrece además del general, no en su lugar: para el que arma el evento es más rápido
 * mandar uno solo a un grupo de WhatsApp, y el de rubro sirve cuando le escribe al salón.
 */
export function BotonDeCategoria({ eventoId, yaCreadas }: { eventoId: string; yaCreadas: string[] }) {
  const [estado, accion, creando] = useActionState<EstadoEnlace, FormData>(
    crearEnlaceDeCategoriaAction,
    {},
  );

  const disponibles = CATEGORIAS.filter((c) => !yaCreadas.includes(c.clave));
  if (disponibles.length === 0) return null;

  return (
    <form action={accion} className="mt-5 flex flex-wrap items-end gap-3">
      <input type="hidden" name="eventoId" value={eventoId} />

      <div>
        <label htmlFor="categoria" className="block text-sm font-extrabold">
          Un enlace para un rubro
        </label>
        <select
          id="categoria"
          name="categoria"
          required
          defaultValue=""
          className="mt-2 rounded-xl border px-4 py-3 text-base outline-none focus:border-[var(--slf-violeta)]"
          style={{ borderColor: "var(--slf-borde)", minHeight: "44px" }}
        >
          <option value="">Elegí uno</option>
          {disponibles.map((c) => (
            <option key={c.clave} value={c.clave}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        disabled={creando}
        className="rounded-xl border-2 px-5 text-sm font-extrabold disabled:opacity-50"
        style={{ borderColor: "var(--slf-violeta)", color: "var(--slf-violeta)", minHeight: "44px" }}
      >
        {creando ? "Creando…" : "Crear"}
      </button>

      {estado.error ? (
        <p role="alert" className="w-full text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}
    </form>
  );
}
