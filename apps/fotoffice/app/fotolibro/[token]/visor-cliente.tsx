"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleFontsLoader, TemplateCanvasRenderer } from "@repo/template-editor-ui";
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import { fechaCorta, type ComentarioCliente, type RevisionCliente } from "@/lib/fotolibro/revision-cliente-tipos";

type Props = {
  token: string;
  nombre: string;
  canvas: TemplateV2Canvas;
  bloques: TemplateV2Block[];
  pliegos: number;
  tapa: { canvas: TemplateV2Canvas; bloques: TemplateV2Block[] } | null;
  comentarios: ComentarioCliente[];
  estado: RevisionCliente["estado"];
  aprobacion: RevisionCliente["aprobacion"];
};

const CLAVE_NOMBRE = "fotolibro-cliente-nombre";

function Hoja({ canvas, bloques, pagina, ancho, alto }: { canvas: TemplateV2Canvas; bloques: TemplateV2Block[]; pagina: number; ancho: number; alto: number }) {
  const s = Math.min(ancho / canvas.width, alto / canvas.height);
  return (
    <div className="relative overflow-hidden bg-white shadow-2xl" style={{ width: canvas.width * s, height: canvas.height * s }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: "0 0", width: canvas.width, height: canvas.height }}>
        <TemplateCanvasRenderer canvas={canvas} blocks={bloques} readOnly pageIndex={pagina} />
      </div>
    </div>
  );
}

const fecha = fechaCorta;

/**
 * El libro para el cliente: se hojea con las flechas, se comenta cada pliego y, cuando está
 * conforme, se aprueba con su nombre. Lo que escribe le llega al estudio en el diseñador.
 */
export function VisorCliente(props: Props) {
  const { canvas, bloques, pliegos, tapa } = props;
  const primera = tapa ? -1 : 0;
  const [actual, setActual] = useState(primera);
  const [comentarios, setComentarios] = useState(props.comentarios);
  const [estado, setEstado] = useState(props.estado);
  const [aprobacion, setAprobacion] = useState(props.aprobacion);
  const [texto, setTexto] = useState("");
  const [nombre, setNombre] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const lugarRef = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState({ w: 900, h: 500 });

  useEffect(() => {
    try {
      setNombre(localStorage.getItem(CLAVE_NOMBRE) ?? "");
    } catch {
      // Sin almacenamiento del navegador: se pide el nombre cada vez.
    }
  }, []);
  useEffect(() => {
    const el = lugarRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => e && setLugar({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const ir = useCallback((i: number) => setActual(Math.max(primera, Math.min(pliegos - 1, i))), [primera, pliegos]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && ["INPUT", "TEXTAREA"].includes(e.target.tagName)) return;
      if (e.key === "ArrowLeft") ir(actual - 1);
      if (e.key === "ArrowRight") ir(actual + 1);
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [actual, ir]);

  async function enviar(cuerpo: Record<string, unknown>) {
    setEnviando(true);
    setError(null);
    try {
      try {
        localStorage.setItem(CLAVE_NOMBRE, nombre);
      } catch {
        // Sin almacenamiento: no pasa nada.
      }
      const r = await fetch(`/api/fotolibro/cliente/${encodeURIComponent(props.token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...cuerpo, nombre }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; comentarios?: ComentarioCliente[]; estado?: RevisionCliente["estado"]; aprobacion?: RevisionCliente["aprobacion"] };
      if (!r.ok) throw new Error(d.error || "No se pudo enviar.");
      setComentarios(d.comentarios ?? comentarios);
      if (d.estado) setEstado(d.estado);
      setAprobacion(d.aprobacion ?? null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo enviar.");
      return false;
    } finally {
      setEnviando(false);
    }
  }

  const deEste = comentarios.filter((c) => c.pliego === actual);
  const aprobado = estado === "aprobado";
  const etiqueta = actual < 0 ? "Tapa" : `Pliego ${actual + 1} de ${pliegos}`;

  return (
    <main className="flex h-screen flex-col bg-[#18191b] text-white">
      <GoogleFontsLoader />
      <header className="flex flex-none flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <h1 className="font-semibold">{props.nombre}</h1>
        <span className="text-sm text-white/50">{etiqueta}</span>
        <span className="ml-auto">
          {aprobado ? (
            <span className="rounded bg-emerald-600/30 px-3 py-1.5 text-sm text-emerald-200">
              ✓ Aprobado{aprobacion ? ` por ${aprobacion.nombre} el ${fecha(aprobacion.fecha)}` : ""}
            </span>
          ) : (
            <button type="button" onClick={() => setConfirmando(true)} className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500">
              Aprobar el diseño
            </button>
          )}
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <section className="flex min-h-0 flex-1 flex-col">
          <div ref={lugarRef} className="flex min-h-0 flex-1 items-center justify-center p-4">
            {actual < 0 && tapa ? (
              <Hoja canvas={tapa.canvas} bloques={tapa.bloques} pagina={0} ancho={lugar.w - 32} alto={lugar.h - 32} />
            ) : (
              <Hoja canvas={canvas} bloques={bloques} pagina={actual} ancho={lugar.w - 32} alto={lugar.h - 32} />
            )}
          </div>
          <nav className="flex flex-none items-center justify-center gap-3 pb-3">
            <button type="button" onClick={() => ir(actual - 1)} disabled={actual <= primera} className="rounded px-3 py-1 text-lg hover:bg-white/10 disabled:opacity-30" aria-label="Anterior">
              ←
            </button>
            <div className="flex flex-wrap justify-center gap-1">
              {Array.from({ length: pliegos - primera }, (_, k) => k + primera).map((i) => {
                const hay = comentarios.some((c) => c.pliego === i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => ir(i)}
                    title={i < 0 ? "Tapa" : `Pliego ${i + 1}`}
                    className={`h-2.5 rounded-full transition-all ${i === actual ? "w-6 bg-white" : hay ? "w-2.5 bg-amber-400" : "w-2.5 bg-white/30"}`}
                  />
                );
              })}
            </div>
            <button type="button" onClick={() => ir(actual + 1)} disabled={actual >= pliegos - 1} className="rounded px-3 py-1 text-lg hover:bg-white/10 disabled:opacity-30" aria-label="Siguiente">
              →
            </button>
          </nav>
        </section>

        <aside className="flex max-h-[45vh] w-full flex-none flex-col gap-3 overflow-y-auto border-t border-white/10 bg-[#202124] p-4 md:max-h-none md:w-80 md:border-l md:border-t-0">
          <h2 className="text-sm font-semibold">Comentarios · {etiqueta}</h2>
          {deEste.length ? (
            <ul className="space-y-2">
              {deEste.map((c) => (
                <li key={c.id} className={`rounded bg-white/5 p-2 text-sm ${c.resuelto ? "opacity-50" : ""}`}>
                  <p className="whitespace-pre-wrap">{c.texto}</p>
                  <p className="mt-1 text-[11px] text-white/45">
                    {c.nombre || "Cliente"} · {fecha(c.fecha)}
                    {c.resuelto ? " · resuelto por el estudio" : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-white/50">Si querés cambiar algo de esta página (una foto, el orden, un texto), escribilo acá.</p>
          )}
          {!aprobado ? (
            <div className="space-y-2">
              <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} placeholder="Ej.: cambiar la foto de la derecha por una donde estemos los dos" className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm" />
              <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm" />
              <button
                type="button"
                disabled={enviando || !texto.trim()}
                onClick={async () => {
                  if (await enviar({ accion: "comentar", pliego: actual, texto })) setTexto("");
                }}
                className="w-full rounded bg-white/15 px-3 py-1.5 text-sm hover:bg-white/25 disabled:opacity-40"
              >
                {enviando ? "Enviando…" : "Enviar comentario"}
              </button>
            </div>
          ) : null}
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
        </aside>
      </div>

      {confirmando ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={() => setConfirmando(false)}>
          <div className="w-full max-w-sm space-y-3 rounded-lg bg-[#202124] p-5" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold">¿Aprobás el diseño del libro?</h2>
            <p className="text-sm text-white/60">Con tu aprobación, el estudio lo manda a imprimir tal como lo ves. Después ya no se pueden pedir cambios desde acá.</p>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Tu nombre" className="w-full rounded border border-white/15 bg-black/30 px-2 py-1.5 text-sm" />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmando(false)} className="rounded px-3 py-1.5 text-sm text-white/70 hover:bg-white/10">
                Todavía no
              </button>
              <button
                type="button"
                disabled={!nombre.trim() || enviando}
                onClick={async () => {
                  if (await enviar({ accion: "aprobar" })) setConfirmando(false);
                }}
                className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500 disabled:opacity-40"
              >
                Sí, apruebo
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
