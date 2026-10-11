"use client";

import { useEffect, useRef, useState } from "react";
import type { ComentarioPublico, FotoPublica } from "@/lib/galerias/publico-tipos";
import { PanelComentarios } from "./comentarios";
import { IconoCerrar, IconoCheck, IconoComentario, IconoDescarga, IconoFlechaDer, IconoFlechaIzq } from "./iconos";

const sinMenu = (e: React.SyntheticEvent) => e.preventDefault();
const UMBRAL_DESLIZAR = 50;

export type PropsVisor = {
  /** Las fotos que se pueden recorrer (congeladas al abrir). */
  fotos: FotoPublica[];
  indice: number;
  /** Número de cada foto en la galería completa. */
  numeros: ReadonlyMap<string, number>;
  total: number;
  vistas: Readonly<Record<string, string>>;
  seleccionadas: ReadonlySet<string>;
  comentarios: (fotoId: string) => ComentarioPublico[];
  nombreEstudio: string;
  editable: boolean;
  permiteComentarios: boolean;
  permiteDescarga: boolean;
  onIr: (indice: number) => void;
  onCerrar: () => void;
  onAlternar: (id: string) => void;
  onComentar: (fotoId: string, texto: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onDescargar: (fotoId: string) => void;
  /** La vista firmada falló al cargar (venció): que se pida otra. */
  onVistaFallida: (fotoId: string) => void;
};

/**
 * La foto en grande: flechas, teclado (← → Esc), deslizar con el dedo, elegir o quitar y comentar sin salir.
 * Mientras llega la vista grande se muestra la miniatura estirada.
 */
export function Visor(p: PropsVisor) {
  const foto = p.fotos[p.indice];
  const [verComentarios, setVerComentarios] = useState(false);
  const [cargada, setCargada] = useState<string | null>(null);
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const cierre = useRef<HTMLButtonElement>(null);
  const previo = useRef<Element | null>(null);

  // Teclado. Si está escribiendo un comentario, las flechas son del cuadro de texto.
  const { onIr, onCerrar, indice, fotos } = p;
  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      const destino = e.target as HTMLElement | null;
      const escribiendo = destino?.tagName === "TEXTAREA" || destino?.tagName === "INPUT";
      if (e.key === "Escape") onCerrar();
      else if (escribiendo) return;
      else if (e.key === "ArrowLeft" && indice > 0) onIr(indice - 1);
      else if (e.key === "ArrowRight" && indice < fotos.length - 1) onIr(indice + 1);
    }
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [onIr, onCerrar, indice, fotos.length]);

  // Foco al abrir y al cerrar; sin scroll de fondo mientras está abierto.
  useEffect(() => {
    previo.current = document.activeElement;
    cierre.current?.focus();
    const antes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = antes;
      if (previo.current instanceof HTMLElement) previo.current.focus();
    };
  }, []);

  if (!foto) return null;
  const elegida = p.seleccionadas.has(foto.id);
  const lista = p.comentarios(foto.id);
  const hayPanel = p.permiteComentarios || lista.length > 0;
  const vista = p.vistas[foto.id];

  function empezar(e: React.TouchEvent) {
    inicio.current = e.touches.length === 1 ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : null;
  }
  function terminar(e: React.TouchEvent) {
    const i = inicio.current;
    inicio.current = null;
    if (!i || e.changedTouches.length === 0) return;
    const dx = e.changedTouches[0].clientX - i.x;
    const dy = e.changedTouches[0].clientY - i.y;
    if (Math.abs(dx) < UMBRAL_DESLIZAR || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    if (dx < 0 && p.indice < p.fotos.length - 1) p.onIr(p.indice + 1);
    else if (dx > 0 && p.indice > 0) p.onIr(p.indice - 1);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Foto ${(p.numeros.get(foto.id) ?? 0) + 1} de ${p.total}`}
      className="fixed inset-0 z-50 flex select-none flex-col bg-black/95 text-white"
      onContextMenu={sinMenu}
    >
      <header className="flex items-center justify-between gap-2 px-3 py-2">
        <p className="text-sm tabular-nums" aria-live="polite">
          Foto {(p.numeros.get(foto.id) ?? 0) + 1} de {p.total}
        </p>
        <button ref={cierre} type="button" onClick={p.onCerrar} aria-label="Cerrar" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-white/10">
          <IconoCerrar />
        </button>
      </header>

      <div className="relative min-h-0 flex-1" onTouchStart={empezar} onTouchEnd={terminar}>
        <div key={foto.id} className="absolute inset-0 p-1 sm:p-4">
          {foto.thumbUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={foto.thumbUrl} alt="" draggable={false} referrerPolicy="no-referrer" className="absolute inset-0 h-full w-full object-contain opacity-80 blur-sm" />
          ) : null}
          {vista ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={vista}
              alt={`Foto ${(p.numeros.get(foto.id) ?? 0) + 1}`}
              draggable={false}
              referrerPolicy="no-referrer"
              onContextMenu={sinMenu}
              onDragStart={sinMenu}
              onLoad={() => setCargada(foto.id)}
              onError={() => p.onVistaFallida(foto.id)}
              className={`absolute inset-0 h-full w-full object-contain transition-opacity duration-200 [-webkit-touch-callout:none] ${cargada === foto.id ? "opacity-100" : "opacity-0"}`}
            />
          ) : null}
          {!vista || cargada !== foto.id ? <p className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs">Cargando la foto…</p> : null}
        </div>
        {p.indice > 0 ? (
          <button type="button" onClick={() => p.onIr(p.indice - 1)} aria-label="Foto anterior" className="absolute left-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
            <IconoFlechaIzq width={28} height={28} />
          </button>
        ) : null}
        {p.indice < p.fotos.length - 1 ? (
          <button type="button" onClick={() => p.onIr(p.indice + 1)} aria-label="Foto siguiente" className="absolute right-1 top-1/2 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 hover:bg-black/60">
            <IconoFlechaDer width={28} height={28} />
          </button>
        ) : null}
      </div>

      <footer className="space-y-3 border-t border-white/15 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {verComentarios && hayPanel ? (
          <div className="max-h-[45vh] overflow-y-auto">
            <PanelComentarios
              key={foto.id}
              comentarios={lista}
              nombreEstudio={p.nombreEstudio}
              puedeComentar={p.permiteComentarios && p.editable}
              onEnviar={(t) => p.onComentar(foto.id, t)}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          {p.editable ? (
            <button
              type="button"
              onClick={() => p.onAlternar(foto.id)}
              aria-pressed={elegida}
              className={`fo-btn ${elegida ? "fo-btn-primary" : "fo-btn-secondary"} min-w-44`}
            >
              <IconoCheck />
              {elegida ? "Elegida · tocá para quitar" : "Elegir esta foto"}
            </button>
          ) : (
            <span className="rounded-full bg-white/10 px-3 py-2 text-sm">{elegida ? "Está en tu selección" : "No está en tu selección"}</span>
          )}
          {hayPanel ? (
            <button type="button" onClick={() => setVerComentarios((v) => !v)} aria-expanded={verComentarios} className="fo-btn fo-btn-secondary">
              <IconoComentario />
              Comentarios{lista.length > 0 ? ` (${lista.length})` : ""}
            </button>
          ) : null}
          {p.permiteDescarga ? (
            <button type="button" onClick={() => p.onDescargar(foto.id)} className="fo-btn fo-btn-secondary">
              <IconoDescarga />
              Descargar
            </button>
          ) : null}
        </div>
      </footer>
    </div>
  );
}
