"use client";

import { useCallback, useEffect, useState } from "react";
import { fechaCorta, type RevisionCliente } from "@/lib/fotolibro/revision-cliente-tipos";

type Props = {
  templateId: string;
  /** Guarda lo pendiente antes de compartir: el cliente ve lo último guardado. */
  guardarAntes: () => Promise<boolean>;
  onIr: (pliego: number) => void;
  onCerrar: () => void;
};

const fecha = fechaCorta;

/** Botón de la barra: muestra el estado de la aprobación con un color. */
export function useRevisionCliente(templateId: string) {
  const [datos, setDatos] = useState<{ revision: RevisionCliente | null; revisionActual: number } | null>(null);
  const cargar = useCallback(async () => {
    const r = await fetch(`/api/fotolibro/${encodeURIComponent(templateId)}/revision`, { credentials: "include", cache: "no-store" });
    if (r.ok) setDatos((await r.json()) as { revision: RevisionCliente | null; revisionActual: number });
  }, [templateId]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  return { datos, setDatos, cargar };
}

/**
 * La aprobación del cliente vista desde el estudio: el enlace para mandarle, en qué quedó y sus
 * comentarios por pliego (clic lleva al pliego; se marcan como resueltos al corregirlos).
 */
export function RevisionClienteVentana({ templateId, guardarAntes, onIr, onCerrar }: Props) {
  const { datos, setDatos, cargar } = useRevisionCliente(templateId);
  const [ocupado, setOcupado] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const r = datos?.revision ?? null;
  const enlace = r?.token ? `${window.location.origin}/fotolibro/${r.token}` : null;
  const cambiadoDespues = r?.estado === "aprobado" && r.aprobacion && (datos?.revisionActual ?? 0) > r.aprobacion.revision;

  async function accion(cuerpo: Record<string, unknown>) {
    setOcupado(true);
    setError(null);
    try {
      if (cuerpo.accion === "compartir" || cuerpo.accion === "de-nuevo") await guardarAntes();
      const res = await fetch(`/api/fotolibro/${encodeURIComponent(templateId)}/revision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(cuerpo),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(d.error || "No se pudo.");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo.");
    } finally {
      setOcupado(false);
    }
  }

  const porPliego = new Map<number, RevisionCliente["comentarios"]>();
  for (const c of r?.comentarios ?? []) porPliego.set(c.pliego, [...(porPliego.get(c.pliego) ?? []), c]);
  const boton = "rounded border border-white/15 bg-white/5 px-2.5 py-1 text-xs hover:bg-white/10 disabled:opacity-40";

  return (
    <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-black/70 p-6" onClick={onCerrar}>
      <div className="flex max-h-full w-full max-w-xl flex-col gap-3 overflow-hidden rounded-lg bg-[#202124] p-5 text-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center gap-2">
          <h2 className="text-base font-semibold">Aprobación del cliente</h2>
          {r ? (
            <span className={`rounded px-2 py-0.5 text-[11px] ${r.estado === "aprobado" ? "bg-emerald-600/30 text-emerald-200" : r.estado === "cambios" ? "bg-amber-500/25 text-amber-200" : "bg-white/10 text-white/70"}`}>
              {r.estado === "aprobado" ? "Aprobado" : r.estado === "cambios" ? "Pidió cambios" : "Esperando respuesta"}
            </span>
          ) : null}
          <button type="button" onClick={onCerrar} className="ml-auto rounded px-2 py-1 text-white/70 hover:bg-white/10">
            Cerrar
          </button>
        </header>

        {!datos ? (
          <p className="text-sm text-white/60">Cargando…</p>
        ) : !enlace ? (
          <div className="space-y-2">
            <p className="text-sm text-white/70">
              Mandale al cliente un enlace para que hojee el libro, comente cada pliego y lo apruebe. No necesita cuenta. Ve las fotos en
              calidad de pantalla: los originales no salen del estudio.
            </p>
            <button type="button" disabled={ocupado} onClick={() => void accion({ accion: "compartir" })} className="rounded bg-[var(--fo-accent)] px-3 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-50">
              Crear enlace para el cliente
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input readOnly value={enlace} className="min-w-0 flex-1 rounded border border-white/15 bg-black/30 px-2 py-1 text-xs" onFocus={(e) => e.target.select()} />
              <button
                type="button"
                className={boton}
                onClick={() => {
                  void navigator.clipboard?.writeText(enlace).then(() => {
                    setCopiado(true);
                    setTimeout(() => setCopiado(false), 2000);
                  });
                }}
              >
                {copiado ? "¡Copiado!" : "Copiar"}
              </button>
              <a className={boton} href={`https://wa.me/?text=${encodeURIComponent(`Te paso el diseño de tu fotolibro para que lo veas y lo apruebes: ${enlace}`)}`} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </div>
            {r?.aprobacion && r.estado === "aprobado" ? (
              <p className="text-xs text-emerald-200">
                Aprobado por {r.aprobacion.nombre} el {fecha(r.aprobacion.fecha)}.
                {cambiadoDespues ? <span className="block text-amber-300">Ojo: el libro cambió después de la aprobación. Si es un cambio de fondo, pedí aprobación de nuevo.</span> : null}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {r?.estado !== "pendiente" ? (
                <button type="button" disabled={ocupado} className={boton} onClick={() => void accion({ accion: "de-nuevo" })} title="Después de corregir: el cliente vuelve a ver el libro y puede aprobarlo">
                  Pedir aprobación de nuevo
                </button>
              ) : null}
              <button type="button" disabled={ocupado} className={boton} onClick={() => void accion({ accion: "dejar" })} title="El enlace deja de funcionar">
                Dejar de compartir
              </button>
            </div>
          </div>
        )}

        {r?.comentarios.length ? (
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto border-t border-white/10 pt-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Comentarios del cliente</h3>
            {[...porPliego.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([pliego, lista]) => (
                <div key={pliego} className="space-y-1">
                  <button type="button" onClick={() => onIr(pliego)} className="text-xs font-medium text-[var(--fo-accent)] hover:underline">
                    {pliego < 0 ? "Tapa" : `Pliego ${pliego + 1}`} →
                  </button>
                  {lista.map((c) => (
                    <label key={c.id} className={`flex gap-2 rounded bg-white/5 p-2 text-sm ${c.resuelto ? "opacity-50" : ""}`}>
                      <input
                        type="checkbox"
                        checked={c.resuelto}
                        onChange={(e) => {
                          const resuelto = e.target.checked;
                          setDatos((d) => (d?.revision ? { ...d, revision: { ...d.revision, comentarios: d.revision.comentarios.map((x) => (x.id === c.id ? { ...x, resuelto } : x)) } } : d));
                          void accion({ accion: "resolver", id: c.id, resuelto });
                        }}
                        className="mt-0.5 accent-[var(--fo-accent)]"
                        title="Resuelto"
                      />
                      <span>
                        <span className="whitespace-pre-wrap">{c.texto}</span>
                        <span className="block text-[11px] text-white/45">
                          {c.nombre || "Cliente"} · {fecha(c.fecha)}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        ) : null}
        {error ? <p className="text-xs text-red-300">{error}</p> : null}
      </div>
    </div>
  );
}
