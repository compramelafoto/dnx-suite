"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { buscarOpcionesRelacionAction } from "@/app/actions/listado";
import type { Opcion } from "@/lib/listado/tipos";

/**
 * Filtro por otra tabla con muchas filas (p. ej. cliente): se escribe, el servidor sugiere hasta
 * 20 coincidencias y la elegida queda en un campo oculto con el nombre del filtro.
 */
export function FiltroRelacion({
  lista,
  clave,
  etiqueta,
  valorInicial,
  etiquetaInicial,
}: {
  lista: string;
  clave: string;
  etiqueta: string;
  valorInicial: string;
  etiquetaInicial: string;
}) {
  const idLista = useId();
  const [elegida, setElegida] = useState<Opcion | null>(
    valorInicial ? { valor: valorInicial, etiqueta: etiquetaInicial || valorInicial } : null,
  );
  const [texto, setTexto] = useState("");
  const [sugerencias, setSugerencias] = useState<Opcion[]>([]);
  const [buscando, startTransition] = useTransition();
  const oculto = useRef<HTMLInputElement>(null);

  /** Elegir o quitar aplica el filtro enseguida (el campo oculto todavía no se volvió a dibujar). */
  function elegir(o: Opcion | null) {
    setElegida(o);
    setTexto("");
    setSugerencias([]);
    if (!oculto.current) return;
    oculto.current.value = o?.valor ?? "";
    oculto.current.form?.requestSubmit();
  }

  useEffect(() => {
    const t = texto.trim();
    if (t.length < 2) return;
    const espera = window.setTimeout(() => {
      startTransition(async () => {
        setSugerencias(await buscarOpcionesRelacionAction(lista, clave, t));
      });
    }, 300);
    return () => window.clearTimeout(espera);
  }, [texto, lista, clave]);

  const abierta = !elegida && texto.trim().length >= 2;

  return (
    <div className="relative flex min-w-48 flex-col gap-1 text-sm">
      <span className="fo-label">{etiqueta}</span>
      <input ref={oculto} type="hidden" name={clave} value={elegida?.valor ?? ""} />
      {elegida ? (
        <div className="fo-input items-center justify-between gap-2">
          <span className="truncate">{elegida.etiqueta}</span>
          <button type="button" className="fo-icon-btn !size-6" aria-label={`Quitar ${etiqueta}`} onClick={() => elegir(null)}>
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <input
          type="text"
          className="fo-input"
          role="combobox"
          aria-label={etiqueta}
          aria-expanded={abierta}
          aria-controls={idLista}
          aria-autocomplete="list"
          placeholder="Escribí para buscar…"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            // Enter elige la primera sugerencia en lugar de mandar el formulario a medias.
            if (e.key === "Enter" && abierta) {
              e.preventDefault();
              if (sugerencias[0]) elegir(sugerencias[0]);
            }
          }}
        />
      )}
      {abierta ? (
        <ul id={idLista} role="listbox" className="fo-popover absolute top-full z-20 mt-1 max-h-64 w-full overflow-y-auto py-1">
          {sugerencias.length === 0 ? (
            <li className="px-3 py-2 text-[var(--fo-muted)]">{buscando ? "Buscando…" : "Sin coincidencias"}</li>
          ) : (
            sugerencias.map((o) => (
              <li key={o.valor} role="option" aria-selected={false}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-[var(--fo-surface-hover)]"
                  onClick={() => elegir(o)}
                >
                  {o.etiqueta}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
