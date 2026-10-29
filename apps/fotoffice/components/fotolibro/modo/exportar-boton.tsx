"use client";

import { useState } from "react";
import { armarZip } from "@/lib/fotolibro/modo/zip";
import type { Problema } from "@/lib/fotolibro/modo/revision";

type Props = {
  templateId: string;
  nombre: string;
  cantidadPliegos: number;
  /** Si el libro tiene tapa elegida: va primera en el ZIP, como `tapa.jpg`. */
  conTapa: boolean;
  /** La revisión del libro (ver `revisarLibro`): se muestra antes de exportar. */
  revisar: () => Problema[];
  /** Lleva al pliego de un problema (-1 = tapa). */
  onIr: (pliego: number) => void;
  /** Guarda lo pendiente antes de exportar: el servidor arma los pliegos desde lo guardado. */
  guardarAntes: () => Promise<boolean>;
};

/**
 * "Exportar para el laboratorio": arma cada pliego en JPG a 300 ppp en el servidor (de a uno,
 * porque cada uno baja sus fotos originales) y los junta en un ZIP listo para mandar.
 */
export function ExportarBoton({ templateId, nombre, cantidadPliegos, conTapa, revisar, onIr, guardarAntes }: Props) {
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problemas, setProblemas] = useState<Problema[] | null>(null);
  const errores = problemas?.filter((p) => p.nivel === "error").length ?? 0;

  async function exportar() {
    setError(null);
    setProblemas(null);
    if (!(await guardarAntes())) {
      setError("No se pudo guardar antes de exportar.");
      return;
    }
    const caras = [
      ...(conTapa ? [{ ruta: "tapa", nombre: "tapa.jpg", etiqueta: "la tapa" }] : []),
      ...Array.from({ length: cantidadPliegos }, (_, i) => ({ ruta: String(i), nombre: `pliego-${String(i + 1).padStart(2, "0")}.jpg`, etiqueta: `el pliego ${i + 1}` })),
    ];
    setAvance({ hechos: 0, total: caras.length });
    try {
      const archivos: { nombre: string; datos: Uint8Array }[] = [];
      for (const [k, cara] of caras.entries()) {
        const r = await fetch(`/api/fotolibro/${encodeURIComponent(templateId)}/exportar/${cara.ruta}`, { credentials: "include" });
        if (!r.ok) {
          const data = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || `No se pudo armar ${cara.etiqueta}.`);
        }
        archivos.push({ nombre: cara.nombre, datos: new Uint8Array(await r.arrayBuffer()) });
        setAvance({ hechos: k + 1, total: caras.length });
      }
      const zip = armarZip(archivos);
      const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${nombre.replace(/[^\p{L}\p{N} _-]+/gu, "").trim() || "fotolibro"}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo exportar.");
    } finally {
      setAvance(null);
    }
  }

  return (
    <span className="flex items-center gap-2">
      {problemas ? (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/70 p-6" onClick={() => setProblemas(null)}>
          <div className="w-full max-w-lg space-y-3 rounded-lg bg-[#202124] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-semibold">Revisión antes de mandar al laboratorio</h2>
            <p className="text-xs text-white/55">
              {errores
                ? "Hay cosas que hay que corregir antes de imprimir. Clic en cada una para ir al pliego."
                : "No hay errores; revisá estos avisos o exportá igual. Clic en cada uno para ir al pliego."}
            </p>
            <ul className="max-h-80 space-y-1 overflow-y-auto">
              {problemas.map((p, i) => (
                <li key={i}>
                  <button
                    type="button"
                    disabled={p.pliego === null}
                    onClick={() => {
                      if (p.pliego === null) return;
                      onIr(p.pliego);
                      setProblemas(null);
                    }}
                    className="flex w-full gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-white/10 disabled:hover:bg-transparent"
                  >
                    <span className={p.nivel === "error" ? "text-red-400" : "text-amber-300"}>{p.nivel === "error" ? "●" : "▲"}</span>
                    <span>{p.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setProblemas(null)} className="rounded px-3 py-1.5 text-xs text-white/70 hover:bg-white/10">
                Volver a corregir
              </button>
              {!errores ? (
                <button type="button" onClick={() => void exportar()} className="rounded bg-[var(--fo-accent)] px-3 py-1.5 text-xs font-medium text-white hover:opacity-90">
                  Exportar igual
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
      {error ? <span className="max-w-xs truncate text-xs text-red-300" title={error}>{error}</span> : null}
      <button
        type="button"
        disabled={avance !== null}
        onClick={() => {
          // Primero la revisión; si no hay nada que mirar, se exporta directo.
          const lista = revisar();
          if (lista.length) setProblemas(lista);
          else void exportar();
        }}
        title="Un JPG por pliego (y la tapa), a 300 ppp, en un ZIP para mandar al laboratorio"
        className="rounded bg-[var(--fo-accent)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {avance ? `Armando ${avance.hechos} de ${avance.total}…` : "Exportar para el laboratorio"}
      </button>
    </span>
  );
}
