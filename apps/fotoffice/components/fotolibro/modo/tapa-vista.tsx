"use client";

import { useEffect, useRef, useState } from "react";
import { ImageCropOverlay, TemplateCanvasRenderer } from "@repo/template-editor-ui";
import type { PhotoCrop, TemplateV2Block } from "@repo/template-editor-core";
import type { ModeloTapa } from "@/lib/fotolibro/tapa/catalogo";
import type { GeometriaTapa, Rect } from "@/lib/fotolibro/tapa/geometria";
import { marcosDeTapa, type LienzoTapa } from "@/lib/fotolibro/tapa/bloques";
import { ARRASTRE_FOTOS } from "./tira-fotos";

export type CaraTapa = "tapa" | "contratapa";

type Props = {
  armado: { modelo: ModeloTapa; geometria: GeometriaTapa; lienzo: LienzoTapa } | null;
  bloques: TemplateV2Block[];
  seleccion: CaraTapa | null;
  recortando: boolean;
  /** Por qué no hay tapa para armar (sin modelo para esta medida y laboratorio). */
  aviso: string | null;
  onSoltar: (cara: CaraTapa, fotoId: string) => void;
  onSeleccionar: (cara: CaraTapa | null) => void;
  onEmpezarRecorte: (cara: CaraTapa) => void;
  onRecorte: (cara: CaraTapa, crop: PhotoCrop) => void;
  onTerminarRecorte: () => void;
};

const idDeCara = (cara: CaraTapa) => (cara === "tapa" ? "tapa-foto" : "contratapa-foto");

function leerIds(dt: DataTransfer): string[] {
  try {
    const raw = dt.getData(ARRASTRE_FOTOS);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * La tapa, grande, tal como se manda al laboratorio: la pieza entera con la demasía sombreada (se
 * dobla sobre el cartón y no se ve) y las líneas de doblez. Se sueltan fotos sobre la tapa o la
 * contratapa; doble clic entra a encuadrarlas.
 */
export function TapaVista({ armado, bloques, seleccion, recortando, aviso, ...props }: Props) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const [lugar, setLugar] = useState({ w: 800, h: 500 });
  const [sobre, setSobre] = useState<CaraTapa | null>(null);

  useEffect(() => {
    const el = contenedorRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      if (e) setLugar({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!armado) {
    return (
      <div ref={contenedorRef} className="grid h-full place-items-center px-6 text-center text-sm text-white/60">
        <p className="max-w-md">{aviso ?? "Elegí el modelo de tapa en el panel de la derecha."}</p>
      </div>
    );
  }

  const { modelo, geometria: g, lienzo } = armado;
  const s = Math.max(0.02, Math.min((lugar.w - 64) / lienzo.width, (lugar.h - 40) / lienzo.height));
  const k = lienzo.width / g.pieza.ancho; // px del lienzo por mm
  const r = (q: Rect) => ({ left: q.x * k, top: q.y * k, width: q.w * k, height: q.h * k });
  const marcos = marcosDeTapa(modelo, g);
  const v = g.visible;
  const borde = 2 / s;
  const recorte = recortando && seleccion ? bloques.find((b) => b.id === idDeCara(seleccion)) ?? null : null;
  const caras: { cara: CaraTapa; marco: Rect; nombre: string }[] = [
    ...(marcos.contratapa ? [{ cara: "contratapa" as const, marco: marcos.contratapa, nombre: "Contratapa" }] : []),
    { cara: "tapa", marco: marcos.tapa, nombre: "Tapa" },
  ];
  // Lo que se dobla hacia adentro: todo lo que queda fuera de lo visible.
  const sombras: Rect[] = [
    { x: 0, y: 0, w: g.pieza.ancho, h: v.y },
    { x: 0, y: v.y + v.h, w: g.pieza.ancho, h: g.pieza.alto - v.y - v.h },
    { x: 0, y: v.y, w: v.x, h: v.h },
    { x: v.x + v.w, y: v.y, w: g.pieza.ancho - v.x - v.w, h: v.h },
  ].filter((q) => q.w > 0.1 && q.h > 0.1);

  return (
    <div ref={contenedorRef} className="flex h-full min-h-0 w-full items-center justify-center px-4">
      <div className="relative flex-none bg-white shadow-2xl" style={{ width: lienzo.width * s, height: lienzo.height * s }}>
        <div className="absolute left-0 top-0" style={{ transform: `scale(${s})`, transformOrigin: "0 0", width: lienzo.width, height: lienzo.height }}>
          <TemplateCanvasRenderer canvas={lienzo} blocks={bloques} readOnly pageIndex={0} />

          {sombras.map((q, i) => (
            <div key={i} className="pointer-events-none absolute bg-slate-900/45" style={{ ...r(q), zIndex: 1000 }} />
          ))}
          {modelo.tipo === "frente" && modelo.demasia.interior > 0 ? (
            <div className="pointer-events-none absolute grid place-items-center overflow-hidden" style={{ ...r({ x: 0, y: v.y, w: v.x, h: v.h }), zIndex: 1001 }}>
              <span className="whitespace-nowrap text-white/80" style={{ fontSize: Math.min(12 / s, v.x * k * 0.5), writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
                Queda bajo el lomo
              </span>
            </div>
          ) : null}
          {g.dobleces.map((d, i) => (
            <div
              key={i}
              className="pointer-events-none absolute"
              style={
                d.x1 === d.x2
                  ? { zIndex: 1001, left: d.x1 * k, top: d.y1 * k, height: (d.y2 - d.y1) * k, borderLeft: `${1.2 / s}px dashed rgba(234,179,8,0.9)` }
                  : { zIndex: 1001, left: d.x1 * k, top: d.y1 * k, width: (d.x2 - d.x1) * k, borderTop: `${1.2 / s}px dashed rgba(234,179,8,0.9)` }
              }
            />
          ))}

          {caras.map(({ cara, marco, nombre }) => {
            const tieneFoto = bloques.some((b) => b.id === idDeCara(cara));
            return (
              <div
                key={cara}
                className="absolute"
                title={tieneFoto ? "Clic: elegir · Doble clic: encuadrar · Soltar otra foto: reemplazar" : "Soltá una foto acá"}
                style={{
                  ...r(marco),
                  zIndex: 1002,
                  background: sobre === cara ? "rgba(250,204,21,0.18)" : "transparent",
                  outline: seleccion === cara ? `${borde}px solid #facc15` : sobre === cara ? `${borde * 1.5}px dashed #eab308` : "none",
                  outlineOffset: -borde,
                  cursor: tieneFoto ? "pointer" : "default",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setSobre(cara);
                }}
                onDragLeave={() => setSobre((x) => (x === cara ? null : x))}
                onDrop={(e) => {
                  e.preventDefault();
                  setSobre(null);
                  const [id] = leerIds(e.dataTransfer);
                  if (id) props.onSoltar(cara, id);
                }}
                onClick={() => props.onSeleccionar(tieneFoto ? cara : null)}
                onDoubleClick={() => {
                  if (!tieneFoto) return;
                  props.onSeleccionar(cara);
                  props.onEmpezarRecorte(cara);
                }}
              >
                {!tieneFoto ? (
                  <div className="flex h-full items-end justify-center pb-[4%] text-center text-slate-400" style={{ fontSize: Math.min(15 / s, marco.w * k * 0.05) }}>
                    {nombre}: soltá una foto
                  </div>
                ) : null}
              </div>
            );
          })}

          {recorte && seleccion ? (
            <ImageCropOverlay block={recorte} canvasZoom={s} onCrop={(crop) => props.onRecorte(seleccion, crop)} onExit={props.onTerminarRecorte} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
