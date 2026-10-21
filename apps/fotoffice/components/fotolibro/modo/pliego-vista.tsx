"use client";

import { useEffect, useRef, useState } from "react";
import { ImageCropOverlay, TemplateCanvasRenderer } from "@repo/template-editor-ui";
import type { PhotoCrop, TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import type { LadoPliego } from "@/lib/fotolibro/modo/estado";
import type { Ubicacion } from "@/lib/fotolibro/modo/operaciones";
import { esBloqueAutomatico } from "@/lib/fotolibro/modo/bloques";
import { ARRASTRE_FOTOS } from "./tira-fotos";

/** Tipo de dato del arrastre de una foto ya puesta en el pliego. */
const ARRASTRE_COLOCADA = "application/x-fotolibro-colocada";

type Props = {
  canvas: TemplateV2Canvas;
  bloques: TemplateV2Block[];
  pliego: number;
  cantidad: number;
  seleccionada: Ubicacion | null;
  recortando: string | null;
  onIrA: (pliego: number) => void;
  onSeleccionar: (u: Ubicacion | null) => void;
  onSoltarFotos: (lado: LadoPliego, ids: string[]) => void;
  onSoltarSobreFoto: (destino: Ubicacion, ids: string[]) => void;
  onIntercambiar: (a: Ubicacion, b: Ubicacion) => void;
  onMover: (desde: Ubicacion, lado: LadoPliego) => void;
  onEmpezarRecorte: (blockId: string) => void;
  onRecorte: (blockId: string, crop: PhotoCrop) => void;
  onTerminarRecorte: () => void;
};

const ubicacionDe = (b: TemplateV2Block): Ubicacion | null => {
  const fotoId = typeof b.configJson.fotoId === "string" ? b.configJson.fotoId : null;
  const m = /^fl-\d+-(izq|der)-/.exec(b.id);
  if (!fotoId || !m) return null;
  return { pliego: b.pageIndex ?? 0, lado: m[1] as LadoPliego, fotoId };
};

function leerJson<T>(dt: DataTransfer, tipo: string): T | null {
  try {
    const raw = dt.getData(tipo);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/** Un pliego chico (el anterior o el siguiente), para ver dónde se está y saltar con un clic. */
function Miniatura({ canvas, bloques, pliego, alto, onClick, etiqueta }: { canvas: TemplateV2Canvas; bloques: TemplateV2Block[]; pliego: number; alto: number; onClick: () => void; etiqueta: string }) {
  const s = alto / canvas.height;
  return (
    <button type="button" onClick={onClick} title={etiqueta} className="group flex-none opacity-50 transition-opacity hover:opacity-90">
      <div className="relative overflow-hidden bg-white shadow" style={{ width: canvas.width * s, height: alto }}>
        <div style={{ transform: `scale(${s})`, transformOrigin: "0 0", width: canvas.width, height: canvas.height, pointerEvents: "none" }}>
          <TemplateCanvasRenderer canvas={canvas} blocks={bloques} readOnly pageIndex={pliego} />
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-white/60">{etiqueta}</p>
    </button>
  );
}

/**
 * El pliego que se está armando, grande, con el anterior y el siguiente a los costados. Encima del
 * dibujo van las zonas donde se sueltan fotos (una por página) y un recuadro por foto puesta: clic
 * la elige, arrastrarla sobre otra las intercambia, doble clic entra a encuadrarla.
 */
export function PliegoVista(props: Props) {
  const { canvas, bloques, pliego, cantidad, seleccionada, recortando } = props;
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState({ w: 800, h: 500 });
  const [sobre, setSobre] = useState<string | null>(null);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setLugar({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Las miniaturas nunca le roban lugar al pliego: a lo sumo un 14% del ancho cada una.
  const proporcion = canvas.width / canvas.height;
  const altoMini = Math.max(24, Math.min(140, lugar.h * 0.22, (lugar.w * 0.14) / proporcion));
  const anchoMini = proporcion * altoMini;
  const s = Math.max(0.02, Math.min((lugar.w - 2 * anchoMini - 64) / canvas.width, (lugar.h - 40) / canvas.height));
  const delPliego = bloques.filter((b) => (b.pageIndex ?? 0) === pliego);
  const fotos = delPliego.filter((b) => b.type === "IMAGE" && esBloqueAutomatico(b));
  const recorte = recortando ? delPliego.find((b) => b.id === recortando) ?? null : null;
  const vacia = (lado: LadoPliego) => !fotos.some((b) => ubicacionDe(b)?.lado === lado);
  const borde = 2 / s;

  function soltarEnPagina(e: React.DragEvent, lado: LadoPliego) {
    e.preventDefault();
    setSobre(null);
    const desde = leerJson<Ubicacion>(e.dataTransfer, ARRASTRE_COLOCADA);
    if (desde) return props.onMover(desde, lado);
    const ids = leerJson<string[]>(e.dataTransfer, ARRASTRE_FOTOS);
    if (ids?.length) props.onSoltarFotos(lado, ids);
  }

  return (
    <div ref={contenedorRef} className="flex h-full min-h-0 w-full items-center justify-center gap-6 px-4">
      {pliego > 0 ? (
        <Miniatura canvas={canvas} bloques={bloques} pliego={pliego - 1} alto={altoMini} etiqueta={`Pliego ${pliego}`} onClick={() => props.onIrA(pliego - 1)} />
      ) : (
        <div style={{ width: anchoMini }} />
      )}

      <div className="relative flex-none bg-white shadow-2xl" style={{ width: canvas.width * s, height: canvas.height * s }}>
        <div
          className="absolute left-0 top-0"
          style={{ transform: `scale(${s})`, transformOrigin: "0 0", width: canvas.width, height: canvas.height }}
          onClick={(e) => {
            if (e.target === e.currentTarget) props.onSeleccionar(null);
          }}
        >
          <TemplateCanvasRenderer canvas={canvas} blocks={bloques} readOnly pageIndex={pliego} />

          {(["izq", "der"] as const).map((lado) => (
            <div
              key={lado}
              className="absolute top-0"
              style={{
                left: lado === "izq" ? 0 : canvas.width / 2,
                width: canvas.width / 2,
                height: canvas.height,
                background: sobre === lado ? "rgba(250,204,21,0.18)" : "transparent",
                outline: sobre === lado ? `${borde * 1.5}px dashed #eab308` : "none",
                outlineOffset: -borde * 2,
              }}
              onClick={() => props.onSeleccionar(null)}
              onDragOver={(e) => {
                e.preventDefault();
                setSobre(lado);
              }}
              onDragLeave={() => setSobre((x) => (x === lado ? null : x))}
              onDrop={(e) => soltarEnPagina(e, lado)}
            >
              {vacia(lado) ? (
                <div className="grid h-full place-items-center text-center text-slate-400" style={{ fontSize: 15 / s }}>
                  Soltá fotos acá
                </div>
              ) : null}
            </div>
          ))}

          {fotos.map((b) => {
            const u = ubicacionDe(b);
            if (!u) return null;
            const elegida = seleccionada && seleccionada.fotoId === u.fotoId && seleccionada.lado === u.lado && seleccionada.pliego === u.pliego;
            const clave = `foto:${b.id}`;
            return (
              <div
                key={b.id}
                draggable={!recortando}
                onDragStart={(e) => {
                  e.dataTransfer.setData(ARRASTRE_COLOCADA, JSON.stringify(u));
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSobre(clave);
                }}
                onDragLeave={() => setSobre((x) => (x === clave ? null : x))}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSobre(null);
                  const desde = leerJson<Ubicacion>(e.dataTransfer, ARRASTRE_COLOCADA);
                  if (desde) return props.onIntercambiar(desde, u);
                  const ids = leerJson<string[]>(e.dataTransfer, ARRASTRE_FOTOS);
                  if (ids?.length) props.onSoltarSobreFoto(u, ids);
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  props.onSeleccionar(u);
                }}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  props.onSeleccionar(u);
                  props.onEmpezarRecorte(b.id);
                }}
                title="Clic: elegir · Arrastrar sobre otra: intercambiar · Doble clic: encuadrar"
                className="absolute cursor-grab"
                style={{
                  left: b.layout.x,
                  top: b.layout.y,
                  width: b.layout.width,
                  height: b.layout.height,
                  outline: elegida ? `${borde}px solid #facc15` : sobre === clave ? `${borde * 1.5}px solid #22c55e` : "none",
                  outlineOffset: 0,
                }}
              />
            );
          })}

          {/* El lomo: el centro del pliego, donde se dobla. */}
          <div
            className="pointer-events-none absolute top-0"
            style={{ left: canvas.width / 2, width: 0, height: canvas.height, borderLeft: `${1 / s}px dashed rgba(100,116,139,0.6)` }}
          />

          {recorte ? (
            <ImageCropOverlay
              block={recorte}
              canvasZoom={s}
              onCrop={(crop) => props.onRecorte(recorte.id, crop)}
              onExit={props.onTerminarRecorte}
            />
          ) : null}
        </div>
      </div>

      {pliego < cantidad - 1 ? (
        <Miniatura canvas={canvas} bloques={bloques} pliego={pliego + 1} alto={altoMini} etiqueta={`Pliego ${pliego + 2}`} onClick={() => props.onIrA(pliego + 1)} />
      ) : (
        <div style={{ width: anchoMini }} />
      )}
    </div>
  );
}
