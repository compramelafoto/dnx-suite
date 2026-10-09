"use client";

import { useState } from "react";

/**
 * Copiar el enlace de la pantalla para mandárselo al DJ.
 *
 * Es el gesto más repetido del día del evento y hasta ahora había que seleccionar la
 * dirección a mano desde el celular, parado en el salón.
 *
 * El `<input>` de respaldo no es decorativo: `navigator.clipboard` sólo existe en
 * contextos seguros y algunos navegadores lo bloquean. Si falla, el texto queda
 * seleccionado para copiarlo a mano en vez de dejar al fotógrafo sin salida.
 */
export function CopiarEnlace({ url, que }: { url: string; que: string }) {
  const [copiado, setCopiado] = useState(false);
  const [fallo, setFallo] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(url);
      setCopiado(true);
      setFallo(false);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setFallo(true);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3">
        <code
          className="min-w-0 flex-1 overflow-x-auto rounded-xl px-4 py-3 text-sm"
          style={{ background: "var(--slf-crema)", border: "1px solid var(--slf-borde)" }}
        >
          {url}
        </code>
        <button
          type="button"
          onClick={() => void copiar()}
          className="inline-flex min-h-[44px] items-center rounded-xl px-5 font-extrabold"
          style={{ background: "var(--slf-violeta)", color: "white" }}
        >
          {copiado ? "Copiado" : `Copiar ${que}`}
        </button>
      </div>

      {fallo ? (
        <p className="mt-2 text-sm" style={{ color: "var(--slf-tinta-suave)" }}>
          Tu navegador no nos deja copiar solo. Marcá la dirección de arriba y copiala a
          mano.
        </p>
      ) : null}
    </div>
  );
}
