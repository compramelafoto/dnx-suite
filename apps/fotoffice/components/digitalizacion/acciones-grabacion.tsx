// apps/fotoffice/components/digitalizacion/acciones-grabacion.tsx
"use client";

import { useState, useTransition } from "react";
import { descartarGrabacionAction, guardarAjustesAction, terminarConLoGrabadoAction, urlsDeLecturaAction } from "@/app/(shell)/digitalizacion/actions";
import { elegirArchivoDeDestino } from "@/lib/digitalizacion/cliente/apis-navegador";
import { descargarCrudo } from "@/lib/digitalizacion/cliente/descargar-crudo";
import type { EstadoVisible } from "@/lib/digitalizacion/validar";

export function AccionesGrabacion({ id, estado, nombreArchivo }: { id: string; estado: EstadoVisible; nombreArchivo: string }) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const bajar = async () => {
    // El selector de archivos va primero: el navegador sólo lo abre si es lo primero que pasa dentro del clic.
    let destino: FileSystemWritableFileStream;
    try {
      destino = await elegirArchivoDeDestino(nombreArchivo);
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setAviso(e instanceof Error ? e.message : "No se pudo elegir el archivo.");
      return;
    }
    try {
      const r = await urlsDeLecturaAction(id);
      if (!r.ok) throw new Error(r.error);
      if (r.urls.length === 0) throw new Error("Todavía no hay partes subidas.");
      await descargarCrudo(destino, r.urls, (h, t) => setAviso(`Descargando ${h} de ${t}…`));
      setAviso("Descarga completa.");
    } catch (e) {
      // `descargarCrudo` ya aborta el destino; acá cubrimos los fallos anteriores.
      try { await destino.abort(); } catch { /* ya estaba abortado */ }
      setAviso(e instanceof Error ? e.message : "No se pudo descargar.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {estado === "INTERRUMPIDA" ? (
        <>
          <a className="fo-btn fo-btn-primary text-xs" href={`/digitalizacion/grabar?continuar=${id}`}>Continuar</a>
          <button type="button" className="fo-btn fo-btn-secondary text-xs" disabled={pendiente} onClick={() => empezar(async () => { const r = await terminarConLoGrabadoAction(id); if (!r.ok) setAviso(r.error); })}>Terminar con lo grabado</button>
        </>
      ) : null}
      <button type="button" className="fo-btn fo-btn-secondary text-xs" onClick={() => void bajar()}>Descargar crudo</button>
      <button
        type="button"
        className="fo-btn fo-btn-danger text-xs"
        disabled={pendiente || estado === "GRABANDO"}
        onClick={() => {
          if (!window.confirm("¿Descartar esta grabación? Se borra todo lo subido y no se puede deshacer.")) return;
          empezar(async () => { const r = await descartarGrabacionAction(id); if (!r.ok) setAviso(r.error); });
        }}
      >
        Descartar
      </button>
      {aviso ? <span className="text-gray-600">{aviso}</span> : null}
    </div>
  );
}

export function AjusteMinutos({ minutos }: { minutos: number }) {
  const [valor, setValor] = useState(minutos);
  const [aviso, setAviso] = useState<string | null>(null);
  return (
    <form className="flex items-center gap-2 text-sm" action={async () => { const r = await guardarAjustesAction(valor); setAviso(r.ok ? "Guardado." : r.error); }}>
      <label>Cortar tras
        <input type="number" min={1} max={30} className="mx-2 w-16 rounded border p-1" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
        minutos sin imagen
      </label>
      <button type="submit" className="fo-btn fo-btn-secondary text-xs">Guardar</button>
      {aviso ? <span>{aviso}</span> : null}
    </form>
  );
}
