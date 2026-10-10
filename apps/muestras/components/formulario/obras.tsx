"use client";

import { useState } from "react";
import { MAX_HIGHLIGHTS, MAX_WORKS } from "@repo/muestras";
import type { ObraForm } from "@/lib/actividades/mapear";
import { subirImagen } from "./subir-imagen";
import { VincularPerfil } from "./vincular-perfil";

/** Desde cuántos lugares libres se avisa que se acerca el tope técnico (no es un tope de diseño). */
const AVISO_TOPE = 20;

/** `queSeVe`: qué ve el público online según la sorpresa de la muestra (lo arma el servidor con `queSeVeOnline`). */
export function EditorObras({ obras, onCambio, queSeVe }: { obras: ObraForm[]; onCambio: (o: ObraForm[]) => void; queSeVe?: string }) {
  const [subiendo, setSubiendo] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const destacadas = obras.filter((o) => o.isHighlight).length;

  async function agregar(files: FileList | null) {
    if (!files) return;
    const lugar = MAX_WORKS - obras.length;
    const lista = Array.from(files).slice(0, lugar);
    if (files.length > lugar) setError(`El tope técnico es de ${MAX_WORKS} obras por muestra; se agregaron ${lista.length}.`);
    setSubiendo(lista.length);
    const nuevas: ObraForm[] = [];
    for (const f of lista) {
      try {
        const url = await subirImagen(f, "obra");
        nuevas.push({ imageUrl: url, title: f.name.replace(/\.[^.]+$/, ""), authorName: "", year: null, technique: null, isHighlight: false, authorProfileId: null, authorProfileName: null });
      } catch (e) {
        setError(e instanceof Error ? e.message : "No pudimos subir una imagen.");
      }
      setSubiendo((n) => n - 1);
    }
    onCambio([...obras, ...nuevas]);
  }

  const cambiar = (i: number, p: Partial<ObraForm>) => onCambio(obras.map((o, j) => (j === i ? { ...o, ...p } : o)));
  const mover = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= obras.length) return;
    const c = [...obras];
    [c[i], c[j]] = [c[j]!, c[i]!];
    onCambio(c);
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--mf-muted)]">
        {obras.length === 1 ? "1 obra" : `${obras.length} obras`}, {destacadas}/{MAX_HIGHLIGHTS} destacadas.{" "}
        {queSeVe ?? "Mientras la muestra está abierta, el público ve sólo las destacadas."}
      </p>
      {MAX_WORKS - obras.length <= AVISO_TOPE ? (
        <p className="text-sm text-[var(--mf-accent)]">
          {obras.length >= MAX_WORKS
            ? `Llegaste al tope técnico de ${MAX_WORKS} obras por muestra.`
            : `Te ${MAX_WORKS - obras.length === 1 ? "queda 1 lugar" : `quedan ${MAX_WORKS - obras.length} lugares`}: el tope técnico es de ${MAX_WORKS} obras por muestra.`}
        </p>
      ) : null}
      <p className="text-sm text-[var(--mf-muted)]">Si el autor sos vos y tenés perfil de fotógrafo con el mismo nombre, las obras nuevas se vinculan solas al guardar.</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {obras.map((o, i) => (
          <li key={o.imageUrl} className="flex gap-3 rounded-[2px] border border-[var(--mf-line)] bg-white p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={o.imageUrl} alt="" className="h-24 w-24 rounded object-cover" />
            <div className="flex-1 space-y-1 text-sm">
              <input className="w-full border-b" value={o.title} onChange={(e) => cambiar(i, { title: e.target.value })} placeholder="Título" />
              <input className="w-full border-b" value={o.authorName} onChange={(e) => cambiar(i, { authorName: e.target.value })} placeholder="Autor" />
              <VincularPerfil
                nombre={o.authorProfileName ?? null}
                onVincular={(p) => cambiar(i, { authorProfileId: p?.id ?? null, authorProfileName: p?.displayName ?? null })}
              />
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={o.isHighlight}
                    disabled={!o.isHighlight && destacadas >= MAX_HIGHLIGHTS}
                    onChange={(e) => cambiar(i, { isHighlight: e.target.checked })}
                  />
                  Destacada
                </label>
                <button type="button" onClick={() => mover(i, -1)} aria-label="Subir">↑</button>
                <button type="button" onClick={() => mover(i, 1)} aria-label="Bajar">↓</button>
                <button type="button" className="ml-auto text-[var(--mf-accent)]" onClick={() => onCambio(obras.filter((_, j) => j !== i))}>Quitar</button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      {obras.length < MAX_WORKS ? (
        <label className="inline-block cursor-pointer rounded-[2px] border border-dashed border-[var(--mf-line)] px-4 py-3">
          {subiendo > 0 ? `Subiendo ${subiendo}…` : "Agregar fotos"}
          <input type="file" accept="image/*" multiple className="hidden" disabled={subiendo > 0} onChange={(e) => agregar(e.target.files)} />
        </label>
      ) : null}
      {error ? <p className="text-sm text-[var(--mf-accent)]">{error}</p> : null}
    </div>
  );
}
