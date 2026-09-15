"use client";

import { useActionState } from "react";
import {
  pedirArrepentimientoAction,
  type EstadoDeArrepentimiento,
} from "@/app/actions/arrepentimiento";

const ETIQUETA = "block text-sm font-extrabold";
const CAMPO =
  "mt-2 w-full rounded-xl border px-4 py-3 text-base outline-none focus:border-[var(--slf-violeta)]";
const BORDE = { borderColor: "var(--slf-borde)" };

export function FormularioArrepentimiento() {
  const [estado, accion, enviando] = useActionState<EstadoDeArrepentimiento, FormData>(
    pedirArrepentimientoAction,
    {},
  );

  if (estado.constancia) {
    return (
      <div
        className="mt-10 rounded-2xl border p-8"
        style={{ ...BORDE, background: "white" }}
        role="status"
      >
        <p className="text-xl font-extrabold">Recibimos tu solicitud.</p>
        <p className="mt-4" style={{ color: "var(--slf-tinta-suave)" }}>
          Guardá este número de constancia:
        </p>
        <p className="mt-2 text-3xl font-extrabold tracking-wide" style={{ color: "var(--slf-violeta)" }}>
          {estado.constancia}
        </p>
        <p className="mt-5 leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
          Te escribimos al correo que dejaste. Si no tenés noticias, escribinos citando ese
          número.
        </p>
      </div>
    );
  }

  return (
    <form action={accion} className="mt-10 space-y-7">
      <div>
        <label htmlFor="email" className={ETIQUETA}>
          El correo con el que compraste
        </label>
        <input id="email" name="email" type="email" required className={CAMPO} style={BORDE} />
      </div>

      <div>
        <label htmlFor="referencia" className={ETIQUETA}>
          Código del evento o número de la compra
        </label>
        <input
          id="referencia"
          name="referencia"
          required
          placeholder="Por ejemplo, ABC123"
          className={CAMPO}
          style={BORDE}
        />
        <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Está en el correo de la compra. Si no lo encontrás, escribí lo que recuerdes.
        </p>
      </div>

      <div>
        <label htmlFor="motivo" className={ETIQUETA}>
          Motivo <span className="font-medium opacity-60">(opcional)</span>
        </label>
        <textarea id="motivo" name="motivo" rows={3} className={CAMPO} style={BORDE} />
        <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          No hace falta que expliques nada. Está sólo por si querés contarnos.
        </p>
      </div>

      {estado.error ? (
        <p role="alert" className="text-sm font-extrabold" style={{ color: "#b00020" }}>
          {estado.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={enviando}
        className="rounded-xl px-7 py-4 font-extrabold text-white disabled:opacity-50"
        style={{ background: "var(--slf-violeta)", minHeight: "44px" }}
      >
        {enviando ? "Enviando…" : "Pedir la cancelación"}
      </button>
    </form>
  );
}
