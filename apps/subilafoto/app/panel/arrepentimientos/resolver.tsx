"use client";

import { useActionState } from "react";
import {
  resolverArrepentimientoAction,
  type EstadoDeResolucion,
} from "@/app/actions/resolver-arrepentimiento";

export type Candidata = { id: string; texto: string; detalle: string };

/**
 * Resolver una solicitud.
 *
 * Pide escribir qué se hizo, no sólo apretar un botón: dentro de seis meses lo que hace
 * falta saber es qué se resolvió.
 */
export function Resolver({ id, candidatas }: { id: string; candidatas: Candidata[] }) {
  const [estado, accion, guardando] = useActionState<EstadoDeResolucion, FormData>(
    resolverArrepentimientoAction,
    {},
  );

  return (
    <form action={accion} className="mt-5 space-y-4">
      <input type="hidden" name="id" value={id} />

      <fieldset>
        <legend className="text-sm font-extrabold">
          {candidatas.length === 0
            ? "No encontramos ninguna compra con ese correo ni ese código"
            : `Compras que podrían ser (${candidatas.length})`}
        </legend>

        {candidatas.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
            Puede estar escrito distinto. Buscala a mano y anotá el número acá abajo.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {candidatas.map((c) => (
              <label
                key={c.id}
                className="flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm"
                style={{ borderColor: "var(--slf-borde)" }}
              >
                <input type="radio" name="orderId" value={c.id} className="mt-1 h-4 w-4" />
                <span>
                  <span className="block font-extrabold">{c.texto}</span>
                  <span className="mt-0.5 block" style={{ color: "var(--slf-tinta-suave)" }}>
                    {c.detalle}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div>
        <label htmlFor={`res-${id}`} className="text-sm font-extrabold">
          Qué se hizo
        </label>
        <textarea
          id={`res-${id}`}
          name="resolucion"
          rows={2}
          required
          placeholder="Devolución hecha por Mercado Pago, avisada por correo."
          className="mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none focus:border-[var(--slf-violeta)]"
          style={{ borderColor: "var(--slf-borde)" }}
        />
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={guardando}
        className="rounded-xl px-6 py-3 text-sm font-extrabold text-white disabled:opacity-50"
        style={{ background: "var(--slf-violeta)", minHeight: "44px" }}
      >
        {guardando ? "Guardando…" : "Marcar resuelta"}
      </button>
    </form>
  );
}
