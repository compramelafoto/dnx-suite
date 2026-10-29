"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImageCropOverlay, TemplateCanvasRenderer } from "@repo/template-editor-ui";
import type { PhotoCrop, TemplateV2Block, TemplateV2Canvas } from "@repo/template-editor-core";
import type { Lado, ModoPliego } from "@/lib/fotolibro/modo/estado";
import type { Ubicacion } from "@/lib/fotolibro/modo/operaciones";
import { esBloqueAutomatico } from "@/lib/fotolibro/modo/bloques";
import { esTextoLibre } from "@/lib/fotolibro/modo/textos-libres";
import { ARRASTRE_FOTOS } from "./tira-fotos";
import { ponerFantasma } from "./fantasma";

/** Tipo de dato del arrastre de una foto ya puesta en el pliego. */
const ARRASTRE_COLOCADA = "application/x-fotolibro-colocada";

type Props = {
  canvas: TemplateV2Canvas;
  bloques: TemplateV2Block[];
  pliego: number;
  cantidad: number;
  modo: ModoPliego;
  /** Miniatura (400 px) de cada foto, por id: los pliegos chicos de los costados no necesitan más. */
  minis: Map<string, string>;
  seleccionada: Ubicacion | null;
  recortando: string | null;
  onIrA: (pliego: number) => void;
  onSeleccionar: (u: Ubicacion | null) => void;
  onSoltarFotos: (lado: Lado, ids: string[]) => void;
  onSoltarSobreFoto: (destino: Ubicacion, ids: string[]) => void;
  onIntercambiar: (a: Ubicacion, b: Ubicacion) => void;
  onMover: (desde: Ubicacion, lado: Lado) => void;
  onEmpezarRecorte: (blockId: string) => void;
  onRecorte: (blockId: string, crop: PhotoCrop) => void;
  onTerminarRecorte: () => void;
  /** Textos agregados a mano: cuál está elegido, y moverlo (`fin` al soltar). */
  textoElegido: string | null;
  onElegirTexto: (id: string | null) => void;
  onMoverTexto: (id: string, x: number, y: number, fin: boolean) => void;
};

const ubicacionDe = (b: TemplateV2Block): Ubicacion | null => {
  const fotoId = typeof b.configJson.fotoId === "string" ? b.configJson.fotoId : null;
  const m = /^fl-\d+-(izq|der|todo)-/.exec(b.id);
  if (!fotoId || !m) return null;
  return { pliego: b.pageIndex ?? 0, lado: m[1] as Lado, fotoId };
};

function leerJson<T>(dt: DataTransfer, tipo: string): T | null {
  try {
    const raw = dt.getData(tipo);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

/**
 * Al cambiar de distribución, cada foto viaja de su lugar viejo al nuevo en vez de saltar: el
 * bloque conserva su id entre variantes, así que alcanza con animar posición y tamaño (y el
 * recorte de la imagen adentro). Mientras se encuadra no se anima: el arrastre tiene que seguir
 * al mouse sin demora.
 */
const ANIMACION = `
.fl-animado [data-block-type="IMAGE"],
.fl-animado [data-block-type="IMAGE"] img,
.fl-animado-marco {
  transition: left 260ms cubic-bezier(.2,.8,.2,1), top 260ms cubic-bezier(.2,.8,.2,1),
    width 260ms cubic-bezier(.2,.8,.2,1), height 260ms cubic-bezier(.2,.8,.2,1) !important;
}
@media (prefers-reduced-motion: reduce) {
  .fl-animado [data-block-type="IMAGE"], .fl-animado [data-block-type="IMAGE"] img, .fl-animado-marco { transition: none !important; }
}`;

/** Un pliego chico (el anterior o el siguiente), para ver dónde se está y saltar con un clic. */
function Miniatura({ canvas, bloques, minis, pliego, alto, onClick, etiqueta }: { canvas: TemplateV2Canvas; bloques: TemplateV2Block[]; minis: Map<string, string>; pliego: number; alto: number; onClick: () => void; etiqueta: string }) {
  const s = alto / canvas.height;
  // Mismas fotos, en su versión más chica: a este tamaño no se nota y baja mucho menos.
  const livianos = useMemo(
    () =>
      bloques
        .filter((b) => (b.pageIndex ?? 0) === pliego)
        .map((b) => {
          const mini = typeof b.configJson.fotoId === "string" ? minis.get(b.configJson.fotoId) : undefined;
          return mini ? { ...b, configJson: { ...b.configJson, previewSrc: mini } } : b;
        }),
    [bloques, minis, pliego],
  );
  return (
    <button type="button" onClick={onClick} title={etiqueta} className="group flex-none opacity-50 transition-opacity hover:opacity-90">
      <div className="relative overflow-hidden bg-white shadow" style={{ width: canvas.width * s, height: alto }}>
        <div style={{ transform: `scale(${s})`, transformOrigin: "0 0", width: canvas.width, height: canvas.height, pointerEvents: "none" }}>
          <TemplateCanvasRenderer canvas={canvas} blocks={livianos} readOnly pageIndex={pliego} />
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
  const { canvas, bloques, pliego, cantidad, seleccionada, recortando, modo } = props;
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState({ w: 800, h: 500 });
  const [sobre, setSobre] = useState<string | null>(null);
  // La foto que se está arrastrando: se ve apagada en su lugar mientras tanto.
  const [arrastrada, setArrastrada] = useState<string | null>(null);

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
  const textos = delPliego.filter(esTextoLibre);
  const arrastre = useRef<{ id: string; dx: number; dy: number; x0: number; y0: number; movio: boolean } | null>(null);
  const vacia = (lado: Lado) => !fotos.some((b) => ubicacionDe(b)?.lado === lado);
  // En un pliego entero se suelta en cualquier lado; por páginas, en cada página.
  const zonas: { lado: Lado; left: number; width: number }[] =
    modo === "pliego"
      ? [{ lado: "todo", left: 0, width: canvas.width }]
      : [
          { lado: "izq", left: 0, width: canvas.width / 2 },
          { lado: "der", left: canvas.width / 2, width: canvas.width / 2 },
        ];
  const borde = 2 / s;

  function soltarEnPagina(e: React.DragEvent, lado: Lado) {
    e.preventDefault();
    setSobre(null);
    const desde = leerJson<Ubicacion>(e.dataTransfer, ARRASTRE_COLOCADA);
    if (desde) return props.onMover(desde, lado);
    const ids = leerJson<string[]>(e.dataTransfer, ARRASTRE_FOTOS);
    if (ids?.length) props.onSoltarFotos(lado, ids);
  }

  return (
    <div ref={contenedorRef} className="flex h-full min-h-0 w-full items-center justify-center gap-6 px-4">
      <style>{ANIMACION}</style>
      {pliego > 0 ? (
        <Miniatura canvas={canvas} bloques={bloques} minis={props.minis} pliego={pliego - 1} alto={altoMini} etiqueta={`Pliego ${pliego}`} onClick={() => props.onIrA(pliego - 1)} />
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
          <TemplateCanvasRenderer canvas={canvas} blocks={bloques} readOnly pageIndex={pliego} className={recortando ? undefined : "fl-animado"} />

          {zonas.map(({ lado, left, width }) => (
            <div
              key={lado}
              className="absolute top-0"
              style={{
                left,
                width,
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
                  ponerFantasma(e, props.minis.get(u.fotoId) ?? (typeof b.configJson.previewSrc === "string" ? b.configJson.previewSrc : null), 1, b.layout.width / b.layout.height);
                  setArrastrada(b.id);
                }}
                onDragEnd={() => setArrastrada(null)}
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
                className={`absolute cursor-grab ${recortando ? "" : "fl-animado-marco"}`}
                style={{
                  left: b.layout.x,
                  top: b.layout.y,
                  width: b.layout.width,
                  height: b.layout.height,
                  zIndex: 1000,
                  outline: elegida ? `${borde}px solid #facc15` : sobre === clave ? `${borde * 1.5}px solid #22c55e` : "none",
                  background: arrastrada === b.id ? "rgba(15,23,42,0.55)" : sobre === clave ? "rgba(34,197,94,0.18)" : "transparent",
                  outlineOffset: 0,
                }}
              />
            );
          })}

          {/* Los textos agregados a mano: clic los elige, arrastrar los mueve. */}
          {textos.map((b) => (
            <div
              key={b.id}
              title="Clic: editar en el panel · Arrastrar: mover"
              className="absolute cursor-move"
              style={{
                left: b.layout.x,
                top: b.layout.y,
                width: b.layout.width,
                height: b.layout.height,
                // Por encima de los bloques del dibujo (que llevan su propio z-index).
                zIndex: 1001,
                outline: props.textoElegido === b.id ? `${borde}px solid #38bdf8` : `${borde / 2}px dashed rgba(56,189,248,0.5)`,
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => {
                e.stopPropagation();
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                props.onElegirTexto(b.id);
                arrastre.current = { id: b.id, dx: e.clientX, dy: e.clientY, x0: b.layout.x, y0: b.layout.y, movio: false };
              }}
              onPointerMove={(e) => {
                const a = arrastre.current;
                if (!a) return;
                a.movio = true;
                props.onMoverTexto(a.id, a.x0 + (e.clientX - a.dx) / s, a.y0 + (e.clientY - a.dy) / s, false);
              }}
              onPointerUp={(e) => {
                const a = arrastre.current;
                arrastre.current = null;
                if (a?.movio) props.onMoverTexto(a.id, a.x0 + (e.clientX - a.dx) / s, a.y0 + (e.clientY - a.dy) / s, true);
              }}
            />
          ))}

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
        <Miniatura canvas={canvas} bloques={bloques} minis={props.minis} pliego={pliego + 1} alto={altoMini} etiqueta={`Pliego ${pliego + 2}`} onClick={() => props.onIrA(pliego + 1)} />
      ) : (
        <div style={{ width: anchoMini }} />
      )}
    </div>
  );
}
