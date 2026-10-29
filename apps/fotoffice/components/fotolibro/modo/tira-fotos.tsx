"use client";

import { useMemo, useRef, useState } from "react";
import { ORDENES, ordenarFotos, type OrdenFotos } from "@/lib/fotolibro/modo/armado";
import type { FotoDelLibro } from "@/lib/fotolibro/modo/estado";

/** Tipo de dato del arrastre de fotos de la tira (ids en JSON). */
export const ARRASTRE_FOTOS = "application/x-fotolibro-fotos";

type Filtro = "todas" | "sin-usar" | "usadas";

type Props = {
  fotos: FotoDelLibro[];
  usos: Map<string, number>;
  seleccion: string[];
  onSeleccion: (ids: string[]) => void;
  onSubir: (archivos: File[]) => void;
  subiendo: { hechas: number; total: number; errores: string[] } | null;
  /** Originales que siguen subiendo de fondo. */
  originales: number;
  orden: OrdenFotos;
  onOrden: (o: OrdenFotos) => void;
};

/**
 * La tira de abajo con todas las fotos del trabajo, como en los diseñadores de fotolibro: las ya
 * usadas se ven apagadas y con su cantidad, se seleccionan varias (⌘/Ctrl o Mayús) y se arrastran
 * al pliego. Soltar archivos encima los sube.
 */
export function TiraFotos({ fotos, usos, seleccion, onSeleccion, onSubir, subiendo, originales, orden, onOrden }: Props) {
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [soltando, setSoltando] = useState(false);
  const archivoRef = useRef<HTMLInputElement>(null);
  const ultimoClic = useRef<string | null>(null);

  const visibles = useMemo(
    () =>
      ordenarFotos(fotos, orden).filter((f) =>
        filtro === "todas" ? true : filtro === "usadas" ? (usos.get(f.id) ?? 0) > 0 : (usos.get(f.id) ?? 0) === 0,
      ),
    [fotos, usos, filtro, orden],
  );
  const sinUsar = fotos.filter((f) => (usos.get(f.id) ?? 0) === 0).length;

  function clic(e: React.MouseEvent, id: string) {
    if (e.shiftKey && ultimoClic.current) {
      const a = visibles.findIndex((f) => f.id === ultimoClic.current);
      const b = visibles.findIndex((f) => f.id === id);
      if (a >= 0 && b >= 0) {
        const tramo = visibles.slice(Math.min(a, b), Math.max(a, b) + 1).map((f) => f.id);
        onSeleccion([...new Set([...seleccion, ...tramo])]);
        return;
      }
    }
    ultimoClic.current = id;
    if (e.metaKey || e.ctrlKey) {
      onSeleccion(seleccion.includes(id) ? seleccion.filter((x) => x !== id) : [...seleccion, id]);
    } else {
      onSeleccion(seleccion.length === 1 && seleccion[0] === id ? [] : [id]);
    }
  }

  return (
    <section
      className={`flex h-full flex-col border-t border-white/10 bg-[#1f2023] ${soltando ? "ring-2 ring-inset ring-[var(--fo-accent)]" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          setSoltando(true);
        }
      }}
      onDragLeave={() => setSoltando(false)}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return;
        e.preventDefault();
        setSoltando(false);
        onSubir([...e.dataTransfer.files]);
      }}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 px-3 py-1.5 text-xs text-white/80">
        <button
          type="button"
          onClick={() => archivoRef.current?.click()}
          className="rounded bg-[var(--fo-accent)] px-2.5 py-1 font-medium text-white hover:opacity-90"
        >
          Subir fotos
        </button>
        <input
          ref={archivoRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const archivos = [...(e.target.files ?? [])];
            e.target.value = "";
            if (archivos.length) onSubir(archivos);
          }}
        />
        <select
          value={orden}
          onChange={(e) => onOrden(e.target.value as OrdenFotos)}
          title="Orden de la tira (y del armado automático)"
          className="rounded border border-white/15 bg-black/30 px-1.5 py-1 text-white"
        >
          {ORDENES.map((o) => (
            <option key={o.id} value={o.id}>
              {o.nombre}
            </option>
          ))}
        </select>
        {(["todas", "sin-usar", "usadas"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFiltro(f)}
            className={`rounded px-2 py-1 ${filtro === f ? "bg-white/15 text-white" : "hover:bg-white/10"}`}
          >
            {f === "todas" ? `Todas (${fotos.length})` : f === "sin-usar" ? `Sin usar (${sinUsar})` : `Usadas (${fotos.length - sinUsar})`}
          </button>
        ))}
        {seleccion.length > 0 ? (
          <span className="ml-1 text-white/60">
            {seleccion.length} {seleccion.length === 1 ? "elegida" : "elegidas"} · Enter arma el pliego · arrastralas a una página
          </span>
        ) : (
          <span className="ml-1 text-white/45">Elegí fotos (⌘/Ctrl o Mayús para varias) y arrastralas al pliego</span>
        )}
        {subiendo ? (
          <span className="ml-auto text-white/70">
            Subiendo {subiendo.hechas} de {subiendo.total}…
            {subiendo.errores.length ? <span className="ml-2 text-red-300">{subiendo.errores.length} con error</span> : null}
          </span>
        ) : null}
        {originales > 0 && !subiendo ? (
          <span className="ml-auto text-xs text-white/50" title="Ya podés armar con estas fotos; el original es lo que se imprime.">
            Subiendo {originales} {originales === 1 ? "original" : "originales"} de fondo…
          </span>
        ) : null}
      </div>

      {fotos.length === 0 ? (
        <div className="grid flex-1 place-items-center text-sm text-white/50">
          Subí las fotos del trabajo (o soltalas acá) para empezar a armar el libro.
        </div>
      ) : (
        <div className="flex flex-1 gap-2 overflow-x-auto overflow-y-hidden px-3 py-2">
          {visibles.map((f) => {
            const usada = usos.get(f.id) ?? 0;
            const elegida = seleccion.includes(f.id);
            return (
              <button
                key={f.id}
                type="button"
                draggable
                onDragStart={(e) => {
                  const ids = elegida ? seleccion : [f.id];
                  if (!elegida) onSeleccion([f.id]);
                  e.dataTransfer.setData(ARRASTRE_FOTOS, JSON.stringify(ids));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={(e) => clic(e, f.id)}
                title={`${f.nombre}${f.tomada ? ` · ${f.tomada.slice(8, 10)}/${f.tomada.slice(5, 7)} ${f.tomada.slice(11, 16)}` : ""} · ${f.w} × ${f.h} px${usada ? ` · usada ${usada} ${usada === 1 ? "vez" : "veces"}` : ""}`}
                className={`relative h-full flex-none overflow-hidden rounded-sm bg-black/30 outline-offset-2 ${elegida ? "outline outline-2 outline-[#facc15]" : ""}`}
                style={{ aspectRatio: `${f.w} / ${f.h}` }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.mini}
                  alt={f.nombre}
                  draggable={false}
                  loading="lazy"
                  className={`h-full w-full object-cover ${usada ? "opacity-40" : ""}`}
                />
                {f.faltaOriginal ? (
                  <span
                    className="absolute left-1 top-1 rounded bg-red-600 px-1 text-[10px] font-semibold text-white"
                    title="No llegó el original de esta foto: volvé a subirla para poder imprimir."
                  >
                    Falta original
                  </span>
                ) : f.claveOriginal ? (
                  <span className="absolute left-1 top-1 h-2 w-2 animate-pulse rounded-full bg-amber-300" title="Subiendo el original…" />
                ) : null}
                {usada ? (
                  <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1 text-[10px] font-semibold text-white">{usada}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
