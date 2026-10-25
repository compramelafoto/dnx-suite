"use client";

import { useState } from "react";
import { armarZip } from "@/lib/fotolibro/modo/zip";

type Props = {
  templateId: string;
  nombre: string;
  cantidadPliegos: number;
  /** Si el libro tiene tapa elegida: va primera en el ZIP, como `tapa.jpg`. */
  conTapa: boolean;
  /** Guarda lo pendiente antes de exportar: el servidor arma los pliegos desde lo guardado. */
  guardarAntes: () => Promise<boolean>;
};

/**
 * "Exportar para el laboratorio": arma cada pliego en JPG a 300 ppp en el servidor (de a uno,
 * porque cada uno baja sus fotos originales) y los junta en un ZIP listo para mandar.
 */
export function ExportarBoton({ templateId, nombre, cantidadPliegos, conTapa, guardarAntes }: Props) {
  const [avance, setAvance] = useState<{ hechos: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function exportar() {
    setError(null);
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
      {error ? <span className="max-w-xs truncate text-xs text-red-300" title={error}>{error}</span> : null}
      <button
        type="button"
        disabled={avance !== null}
        onClick={() => void exportar()}
        title="Un JPG por pliego (y la tapa), a 300 ppp, en un ZIP para mandar al laboratorio"
        className="rounded bg-[var(--fo-accent)] px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
      >
        {avance ? `Armando ${avance.hechos} de ${avance.total}…` : "Exportar para el laboratorio"}
      </button>
    </span>
  );
}
