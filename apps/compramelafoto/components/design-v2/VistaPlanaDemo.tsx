"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { TemplateCanvasRenderer, type PhotoOverride } from "@repo/template-editor-ui";
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import { mejorGrilla } from "./DesignPagesPreview";

/**
 * La vista de un producto que no se dobla (diploma, calendario, señalador…): cada hoja, plana y
 * lo más grande que entre en la pantalla, con el mismo dibujo que el editor y la impresión.
 * Hace las veces del visor 3D del librito en el catálogo.
 */
export default function VistaPlanaDemo({
  titulo,
  subtitulo,
  canvas,
  blocks,
  values,
  photoOverrides,
  pageCount,
  pageLabels,
  onClose,
  acciones,
}: {
  titulo: string;
  subtitulo?: string;
  canvas: TemplateV2Canvas;
  blocks: TemplateV2Block[];
  values: Record<string, string>;
  photoOverrides: Record<string, PhotoOverride>;
  pageCount: number;
  pageLabels: string[];
  onClose: () => void;
  acciones?: ReactNode;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const [tam, setTam] = useState({ width: 0, height: 0 });
  /** Con muchas hojas (un almanaque de 13), de a una con flechas; con pocas, todas juntas. */
  const deAUna = pageCount > 4;
  const [pagina, setPagina] = useState(0);

  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const update = () => setTam({ width: el.clientWidth, height: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (deAUna && e.key === "ArrowRight") setPagina((p) => Math.min(pageCount - 1, p + 1));
      if (deAUna && e.key === "ArrowLeft") setPagina((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, deAUna, pageCount]);

  const w = Number(canvas.width) || 1;
  const h = Number(canvas.height) || 1;
  const paginas = deAUna ? [pagina] : Array.from({ length: Math.max(1, pageCount) }, (_, i) => i);
  const { columnas, escala } = mejorGrilla(paginas.length, tam, { width: w, height: h });
  const etiqueta = (i: number) => pageLabels[i]?.trim() || (pageCount === 1 ? "Diseño" : `Hoja ${i + 1}`);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      className="fixed inset-0 z-[70] flex flex-col bg-[#1f2328]/90 p-3 sm:p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-white">
        <div className="min-w-0">
          <h2 className="m-0 truncate text-lg font-semibold">{titulo}</h2>
          {subtitulo ? <p className="m-0 text-sm text-white/70">{subtitulo}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {acciones}
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-full bg-white/10 px-5 text-[15px] font-semibold text-white ring-1 ring-white/30 hover:bg-white/20"
          >
            Cerrar
          </button>
        </div>
      </div>
      {deAUna ? (
        <div className="mb-3 flex items-center justify-center gap-3 text-white">
          <button
            type="button"
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            disabled={pagina === 0}
            aria-label="Hoja anterior"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-[9rem] text-center text-sm">
            {etiqueta(pagina)} · {pagina + 1} de {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPagina((p) => Math.min(pageCount - 1, p + 1))}
            disabled={pagina === pageCount - 1}
            aria-label="Hoja siguiente"
            className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-xl disabled:opacity-30"
          >
            ›
          </button>
        </div>
      ) : null}
      <div ref={caja} className="min-h-0 flex-1" onClick={(e) => e.target === e.currentTarget && onClose()}>
        {escala > 0 ? (
          <div
            className="mx-auto grid h-full content-center justify-center"
            style={{ gridTemplateColumns: `repeat(${columnas}, ${w * escala}px)`, gap: 12 }}
          >
            {paginas.map((page) => (
              <div
                key={page}
                className="relative overflow-hidden bg-white shadow-2xl"
                style={{ width: w * escala, height: h * escala }}
                aria-label={etiqueta(page)}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    width: w,
                    height: h,
                    transform: `scale(${escala})`,
                    transformOrigin: "top left",
                    pointerEvents: "none",
                  }}
                >
                  <TemplateCanvasRenderer
                    canvas={canvas}
                    blocks={blocks}
                    resolvedVariables={values}
                    readOnly
                    pageIndex={page}
                    photoOverrides={photoOverrides}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
