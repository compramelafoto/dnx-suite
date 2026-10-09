"use client";

import { useState, useTransition } from "react";
import { aprobar, despublicar, rechazar, republicar } from "@/lib/actividades/acciones";

export function AccionesRevision({ id, estado }: { id: string; estado: string }) {
  const [pendiente, start] = useTransition();
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const correr = (f: () => Promise<{ ok: boolean; errores?: string[] }>) =>
    start(async () => {
      const r = await f();
      setError(r.ok ? null : (r.errores ?? []).join(" "));
    });

  return (
    <div className="space-y-2">
      {estado === "IN_REVIEW" ? (
        <>
          <button disabled={pendiente} className="rounded-md bg-green-700 px-3 py-1 text-white" onClick={() => correr(() => aprobar(id))}>Aprobar y publicar</button>
          <div className="flex gap-2">
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo del rechazo" className="flex-1 rounded-md border px-2 py-1" />
            <button disabled={pendiente} className="rounded-md border border-red-700 px-3 py-1 text-red-700" onClick={() => correr(() => rechazar(id, motivo))}>Rechazar</button>
          </div>
        </>
      ) : null}
      {estado === "APPROVED" ? <button disabled={pendiente} className="rounded-md border px-3 py-1" onClick={() => correr(() => despublicar(id))}>Despublicar</button> : null}
      {estado === "UNPUBLISHED" ? <button disabled={pendiente} className="rounded-md border px-3 py-1" onClick={() => correr(() => republicar(id))}>Volver a publicar</button> : null}
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
