"use client";

import { useEffect, useState } from "react";
import { fechaCorta } from "./textos";

type Fila = { id: string; audience: string; createdAt: string; primerTexto: string; textosDelUsuario: number; acciones: number };
type Detalle = { id: string; items: { rol: "usuario" | "bot" | "sistema"; texto: string; fecha: string }[]; acciones: { toolName: string; summary: string; status: string }[] };

/** Charlas con el DNX Bot que no terminaron en reclamo. Las de un solo toque sólo se cuentan arriba. */
export default function ConversacionesResueltas() {
  const [page, setPage] = useState(0);
  const [data, setData] = useState<{ items: Fila[]; hayMas: boolean } | null>(null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<Detalle | null>(null);

  useEffect(() => {
    let vivo = true;
    setData(null);
    fetch(`/api/admin/support/conversaciones?page=${page}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (vivo) setData(d); })
      .catch(() => { if (vivo) setData({ items: [], hayMas: false }); });
    return () => { vivo = false; };
  }, [page]);

  useEffect(() => {
    if (!abierta) return setDetalle(null);
    let vivo = true;
    fetch(`/api/admin/support/conversaciones/${abierta}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => { if (vivo) setDetalle(d); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [abierta]);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">Charlas de dos o más mensajes que el bot resolvió sin pasar a reclamo. Se guardan los últimos 90 días.</p>
      {!data && <p className="text-gray-500">Cargando…</p>}
      {data?.items.length === 0 && <p className="text-gray-500">No hay conversaciones para mostrar.</p>}
      <ul className="space-y-2">
        {data?.items.map((c) => (
          <li key={c.id} className="rounded-lg border border-gray-200 bg-white">
            <button type="button" className="w-full p-3 text-left" onClick={() => setAbierta(abierta === c.id ? null : c.id)}>
              <div className="flex justify-between text-xs text-gray-500">
                <span>{c.audience === "BUYER" ? "Comprador" : "Fotógrafo"} · {c.textosDelUsuario} mensajes{c.acciones ? ` · ${c.acciones} acciones` : ""}</span>
                <span>{fechaCorta(c.createdAt)}</span>
              </div>
              <p className="mt-1 text-sm text-gray-900">{c.primerTexto}</p>
            </button>
            {abierta === c.id && (
              <div className="flex flex-col gap-2 border-t border-gray-100 p-3">
                {!detalle && <p className="text-sm text-gray-500">Cargando…</p>}
                {detalle?.items.map((i, n) => (
                  <div key={n} className={`max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm ${i.rol === "usuario" ? "self-end bg-gray-900 text-white" : i.rol === "bot" ? "self-start bg-gray-100 text-gray-900" : "self-center bg-yellow-50 text-xs text-gray-600"}`}>{i.texto}</div>
                ))}
                {detalle?.acciones.map((a, n) => <p key={n} className="text-xs text-gray-600">{a.status === "EXECUTED" ? "✅" : "•"} {a.summary}</p>)}
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-40">Anteriores</button>
        <button type="button" disabled={!data?.hayMas} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-gray-300 px-3 py-1 text-sm disabled:opacity-40">Más viejas</button>
      </div>
    </div>
  );
}
