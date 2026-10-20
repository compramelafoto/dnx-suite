// apps/fotoffice/components/digitalizacion/acciones-grabacion.tsx
"use client";

import { useState, useTransition } from "react";
import { descartarGrabacionAction, guardarAjustesAction, terminarConLoGrabadoAction, urlsDeLecturaAction } from "@/app/(shell)/digitalizacion/actions";
import { descargarCrudo } from "@/lib/digitalizacion/cliente/descargar-crudo";
import type { EstadoVisible } from "@/lib/digitalizacion/validar";

export function AccionesGrabacion({ id, estado }: { id: string; estado: EstadoVisible }) {
  const [pendiente, empezar] = useTransition();
  const [aviso, setAviso] = useState<string | null>(null);

  const bajar = async () => {
    const r = await urlsDeLecturaAction(id);
    if (!r.ok) { setAviso(r.error); return; }
    if (r.urls.length === 0) { setAviso("Todavía no hay partes subidas."); return; }
    try {
      await descargarCrudo(r.urls, r.nombre, (h, t) => setAviso(`Descargando ${h} de ${t}…`));
      setAviso("Descarga completa.");
    } catch (e) {
      if ((e as DOMException)?.name !== "AbortError") setAviso(e instanceof Error ? e.message : "No se pudo descargar.");
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {estado === "INTERRUMPIDA" ? (
        <>
          <a className="fo-btn fo-btn-primary text-xs" href={`/digitalizacion/grabar?continuar=${id}`}>Continuar</a>
          <button type="button" className="fo-btn text-xs" disabled={pendiente} onClick={() => empezar(async () => { const r = await terminarConLoGrabadoAction(id); if (!r.ok) setAviso(r.error); })}>Terminar con lo grabado</button>
        </>
      ) : null}
      <button type="button" className="fo-btn text-xs" onClick={() => void bajar()}>Descargar crudo</button>
      <button
        type="button"
        className="fo-btn text-xs"
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
      <button type="submit" className="fo-btn text-xs">Guardar</button>
      {aviso ? <span>{aviso}</span> : null}
    </form>
  );
}
