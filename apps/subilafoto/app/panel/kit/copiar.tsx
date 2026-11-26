"use client";

import { useState } from "react";

/** Un texto listo para copiar, con el botón al lado. */
export function TextoParaCopiar({ titulo, texto, uso }: { titulo: string; texto: string; uso?: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      // Sin permiso de portapapeles el texto sigue ahí para seleccionarlo a mano.
      setCopiado(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "var(--slf-borde)" }}>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="font-extrabold">{titulo}</p>
          {uso ? (
            <p className="text-sm" style={{ color: "var(--slf-tinta-suave)" }}>{uso}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={copiar}
          className="min-h-[44px] shrink-0 rounded-xl px-5 font-extrabold text-white"
          style={{ background: "var(--slf-violeta)" }}
          aria-live="polite"
        >
          {copiado ? "¡Copiado!" : "Copiar"}
        </button>
      </div>
      <p className="mt-4 whitespace-pre-line text-[0.95rem] leading-relaxed" style={{ color: "var(--slf-tinta-suave)" }}>
        {texto}
      </p>
    </div>
  );
}
