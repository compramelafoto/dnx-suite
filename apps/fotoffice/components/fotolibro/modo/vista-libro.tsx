"use client";

import { useMemo, useState } from "react";
import { TemplateCanvasRenderer } from "@repo/template-editor-ui";
import type { TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import type { EstadoFotolibro } from "@/lib/fotolibro/modo/estado";

const ARRASTRE_PLIEGO = "application/x-fotolibro-pliego";

type Props = {
  canvas: TemplateV2Canvas;
  bloques: TemplateV2Block[];
  estado: EstadoFotolibro;
  minis: Map<string, string>;
  actual: number;
  /** La tapa ya dibujada (o null si el libro no tiene). */
  tapa: { canvas: TemplateV2Canvas; bloques: TemplateV2Block[] } | null;
  onAbrir: (pliego: number) => void;
  onMover: (desde: number, hasta: number) => void;
  onDuplicar: (pliego: number) => void;
  onQuitar: (pliego: number) => void;
  onAgregar: (despuesDe: number) => void;
};

/** Un pliego chico con sus fotos en miniatura (400 px): a este tamaño no hace falta más. */
function Hoja({ canvas, bloques, pagina, ancho }: { canvas: TemplateV2Canvas; bloques: TemplateV2Block[]; pagina: number; ancho: number }) {
  const s = ancho / canvas.width;
  return (
    <div className="relative overflow-hidden bg-white" style={{ width: ancho, height: canvas.height * s }}>
      <div style={{ transform: `scale(${s})`, transformOrigin: "0 0", width: canvas.width, height: canvas.height, pointerEvents: "none" }}>
        <TemplateCanvasRenderer canvas={canvas} blocks={bloques} readOnly pageIndex={pagina} />
      </div>
    </div>
  );
}

/**
 * Todo el libro de un vistazo, como la vista de libro de los diseñadores profesionales: la tapa y
 * cada pliego en una grilla. Se arrastra un pliego para cambiarlo de lugar, y cada uno se duplica,
 * se borra o se abre con un clic.
 */
export function VistaLibro({ canvas, bloques, estado, minis, actual, tapa, ...props }: Props) {
  const [arrastrando, setArrastrando] = useState<number | null>(null);
  const [sobre, setSobre] = useState<number | null>(null);
  const ancho = 260;

  const livianos = useMemo(
    () =>
      bloques.map((b) => {
        const mini = typeof b.configJson.fotoId === "string" ? minis.get(b.configJson.fotoId) : undefined;
        return mini ? { ...b, configJson: { ...b.configJson, previewSrc: mini } } : b;
      }),
    [bloques, minis],
  );

  return (
    <div className="h-full overflow-y-auto px-6 py-4">
      <div className="flex flex-wrap gap-x-5 gap-y-6">
        {tapa ? (
          <button type="button" onClick={() => props.onAbrir(-1)} className={`text-left ${actual === -1 ? "ring-2 ring-[var(--fo-accent)]" : ""}`}>
            <Hoja canvas={tapa.canvas} bloques={tapa.bloques} pagina={0} ancho={((ancho * canvas.height) / canvas.width) * (tapa.canvas.width / tapa.canvas.height)} />
            <p className="mt-1 text-xs text-white/60">Tapa</p>
          </button>
        ) : null}

        {estado.pliegos.map((p, i) => {
          const fotos = p.todo.fotos.length + p.izq.fotos.length + p.der.fotos.length;
          return (
            <div
              key={i}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(ARRASTRE_PLIEGO, String(i));
                e.dataTransfer.effectAllowed = "move";
                setArrastrando(i);
              }}
              onDragEnd={() => {
                setArrastrando(null);
                setSobre(null);
              }}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes(ARRASTRE_PLIEGO)) return;
                e.preventDefault();
                setSobre(i);
              }}
              onDragLeave={() => setSobre((x) => (x === i ? null : x))}
              onDrop={(e) => {
                e.preventDefault();
                const desde = Number(e.dataTransfer.getData(ARRASTRE_PLIEGO));
                setSobre(null);
                setArrastrando(null);
                if (Number.isInteger(desde) && desde !== i) props.onMover(desde, i);
              }}
              className={`group relative cursor-grab transition-opacity ${arrastrando === i ? "opacity-40" : ""}`}
              style={{ width: ancho }}
            >
              {/* Dónde va a caer: una barra a la izquierda del pliego de destino. */}
              {sobre === i && arrastrando !== null && arrastrando !== i ? (
                <span className={`absolute -top-1 bottom-5 w-1 rounded bg-[var(--fo-accent)] ${arrastrando > i ? "-left-3" : "-right-3"}`} />
              ) : null}
              <button
                type="button"
                onClick={() => props.onAbrir(i)}
                title="Abrir este pliego"
                className={`block shadow ${i === actual ? "ring-2 ring-[var(--fo-accent)]" : "hover:ring-1 hover:ring-white/40"}`}
              >
                <Hoja canvas={canvas} bloques={livianos} pagina={i} ancho={ancho} />
              </button>
              <div className="mt-1 flex items-center justify-between text-xs text-white/60">
                <span>
                  Pliego {i + 1} · {fotos ? `${fotos} ${fotos === 1 ? "foto" : "fotos"}` : "vacío"}
                </span>
                <span className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button type="button" title="Agregar un pliego vacío después" onClick={() => props.onAgregar(i)} className="rounded px-1.5 hover:bg-white/10">
                    +
                  </button>
                  <button type="button" title="Duplicar" onClick={() => props.onDuplicar(i)} className="rounded px-1.5 hover:bg-white/10">
                    ⧉
                  </button>
                  <button
                    type="button"
                    title="Borrar este pliego"
                    disabled={estado.pliegos.length <= 1}
                    onClick={() => props.onQuitar(i)}
                    className="rounded px-1.5 hover:bg-red-500/30 disabled:opacity-30"
                  >
                    ✕
                  </button>
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-white/40">Arrastrá un pliego para cambiarlo de lugar. Clic para abrirlo; G vuelve a esta vista.</p>
    </div>
  );
}
