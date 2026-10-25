"use client";

import { useEffect, useId, useState, useTransition, type KeyboardEvent } from "react";
import { Plus, X } from "lucide-react";
import { buscarEtiquetasAction, ponerEtiquetaAction, quitarEtiquetaAction } from "@/app/actions/ficha";
import { claseDeColorEtiqueta } from "@/lib/ficha/formato";
import type { EtiquetaVista, PersonaFicha, Resultado } from "./tipos";

/**
 * Las etiquetas de la persona: chips con su color, una cruz para quitar y un campo con
 * sugerencias. Enter pone la sugerencia marcada o, si no hay, crea la etiqueta con lo escrito.
 */
export function Etiquetas({ persona, etiquetas }: { persona: PersonaFicha; etiquetas: EtiquetaVista[] }) {
  const id = useId();
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [sugerencias, setSugerencias] = useState<EtiquetaVista[]>([]);
  const [marcada, setMarcada] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  const puestas = new Set(etiquetas.map((e) => e.id));
  const opciones = sugerencias.filter((s) => !puestas.has(s.id));

  // Sugerencias con una pequeña espera, para no consultar en cada tecla.
  useEffect(() => {
    const t = texto.trim();
    if (!t) {
      setSugerencias([]);
      return;
    }
    let vigente = true;
    const espera = setTimeout(async () => {
      const r = await buscarEtiquetasAction(persona, t);
      if (vigente) {
        setSugerencias(r);
        setMarcada(-1);
      }
    }, 200);
    return () => {
      vigente = false;
      clearTimeout(espera);
    };
  }, [texto, persona]);

  function correr(accion: () => Promise<Resultado>, alTerminar?: () => void) {
    setError(null);
    iniciar(async () => {
      const r = await accion();
      if (!r.ok) setError(r.error);
      else alTerminar?.();
    });
  }

  function poner(ref: { tagId: string } | { nombre: string }) {
    correr(
      () => ponerEtiquetaAction(persona, ref),
      () => {
        setTexto("");
        setSugerencias([]);
        setAbierto(false);
      },
    );
  }

  function tecla(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAbierto(true);
      setMarcada((m) => Math.min(m + 1, opciones.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMarcada((m) => Math.max(m - 1, -1));
    } else if (e.key === "Escape") {
      setAbierto(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const elegida = opciones[marcada];
      if (elegida) poner({ tagId: elegida.id });
      else if (texto.trim()) poner({ nombre: texto });
    }
  }

  const listaId = `${id}-lista`;
  const mostrarLista = abierto && opciones.length > 0;

  return (
    <div className="space-y-2">
      <ul className="flex flex-wrap gap-1.5" aria-label="Etiquetas">
        {etiquetas.map((t) => (
          <li key={t.id} className={`inline-flex items-center gap-1 rounded-full py-0.5 pl-2.5 pr-1 text-xs ${claseDeColorEtiqueta(t.color)}`}>
            {t.name}
            <button
              type="button"
              className="rounded-full p-0.5 hover:bg-black/10"
              onClick={() => correr(() => quitarEtiquetaAction(persona, t.id))}
              disabled={pendiente}
              aria-label={`Quitar la etiqueta ${t.name}`}
            >
              <X className="size-3" aria-hidden />
            </button>
          </li>
        ))}
        <li className="relative">
          <label htmlFor={`${id}-campo`} className="sr-only">
            Agregar etiqueta
          </label>
          <div className="flex items-center gap-1 rounded-full border border-dashed border-[var(--fo-border-strong)] px-2 py-0.5 text-xs">
            <Plus className="size-3 text-[var(--fo-muted)]" aria-hidden />
            <input
              id={`${id}-campo`}
              role="combobox"
              aria-expanded={mostrarLista}
              aria-controls={listaId}
              aria-autocomplete="list"
              aria-activedescendant={marcada >= 0 && mostrarLista ? `${id}-op-${marcada}` : undefined}
              value={texto}
              maxLength={40}
              disabled={pendiente}
              onChange={(e) => {
                setTexto(e.target.value);
                setAbierto(true);
              }}
              onKeyDown={tecla}
              onFocus={() => setAbierto(true)}
              onBlur={() => setTimeout(() => setAbierto(false), 150)}
              placeholder="Etiqueta"
              className="w-28 bg-transparent outline-none placeholder:text-[var(--fo-muted)]"
            />
          </div>
          {mostrarLista ? (
            <ul id={listaId} role="listbox" className="fo-popover absolute left-0 top-full z-20 mt-1 w-56 py-1 text-sm">
              {opciones.map((s, i) => (
                <li
                  key={s.id}
                  id={`${id}-op-${i}`}
                  role="option"
                  aria-selected={i === marcada}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    poner({ tagId: s.id });
                  }}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 ${i === marcada ? "bg-[var(--fo-surface-hover)]" : ""}`}
                >
                  <span className={`size-2.5 rounded-full ${claseDeColorEtiqueta(s.color)}`} aria-hidden />
                  {s.name}
                </li>
              ))}
            </ul>
          ) : null}
        </li>
      </ul>
      {error ? (
        <p role="alert" className="text-xs text-[var(--fo-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
