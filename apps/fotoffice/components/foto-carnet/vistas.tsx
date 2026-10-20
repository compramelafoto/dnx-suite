"use client";

import { useEffect, useRef, useState } from "react";
import { cmAPx, MARGEN_CM, SEPARACION_CM, type Grilla, type HojaImpresion } from "@/lib/foto-carnet/medidas";
import { createCroppedPhotoCanvas, generarPlanchaCanvas, loadImage, type AdjustmentSettings, type CropAreaPixels } from "./procesar";

/** Espera un momento antes de redibujar: los ajustes se recalculan píxel a píxel. */
function useDemorado<T>(valor: T, ms = 150): T {
  const [v, setV] = useState(valor);
  useEffect(() => {
    const id = setTimeout(() => setV(valor), ms);
    return () => clearTimeout(id);
  }, [valor, ms]);
  return v;
}

function pintar(destino: HTMLCanvasElement, origen: HTMLCanvasElement) {
  destino.width = origen.width;
  destino.height = origen.height;
  destino.getContext("2d")?.drawImage(origen, 0, 0);
}

/** La foto ya recortada y retocada, a la resolución de impresión. */
export function VistaRecorte({
  imageSrc,
  crop,
  rotation,
  settings,
  medida,
}: {
  imageSrc: string;
  crop: CropAreaPixels;
  rotation: number;
  settings: AdjustmentSettings;
  medida: { anchoCm: number; altoCm: number };
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const ajustes = useDemorado(settings);

  useEffect(() => {
    let activo = true;
    void loadImage(imageSrc).then((image) => {
      if (!activo || !ref.current) return;
      pintar(
        ref.current,
        createCroppedPhotoCanvas({
          image,
          crop,
          outputWidth: cmAPx(medida.anchoCm, 300),
          outputHeight: cmAPx(medida.altoCm, 300),
          settings: ajustes,
          rotation,
        }),
      );
    });
    return () => {
      activo = false;
    };
  }, [imageSrc, crop, rotation, ajustes, medida.anchoCm, medida.altoCm]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--fo-muted)]">Así queda cada foto</p>
      <div
        className="mx-auto w-full max-w-xs rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-white p-3"
        style={{ aspectRatio: `${medida.anchoCm} / ${medida.altoCm}` }}
      >
        <canvas ref={ref} className="h-full w-full" />
      </div>
    </div>
  );
}

/** La plancha completa en baja resolución, para revisar antes de descargar. */
export function VistaPlancha({
  imageSrc,
  crop,
  rotation,
  settings,
  medida,
  hoja,
  grilla,
}: {
  imageSrc: string;
  crop: CropAreaPixels;
  rotation: number;
  settings: AdjustmentSettings;
  medida: { anchoCm: number; altoCm: number };
  hoja: HojaImpresion;
  grilla: Grilla;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let activo = true;
    // La vista se dibuja a 120 dpi: la grilla se escala desde la de impresión (300 dpi).
    const dpi = 120;
    const f = dpi / 300;
    void loadImage(imageSrc).then((image) => {
      if (!activo || !ref.current) return;
      const config = {
        sheetWidthPx: cmAPx(hoja.anchoCm, dpi),
        sheetHeightPx: cmAPx(hoja.altoCm, dpi),
        photoWidthPx: cmAPx(medida.anchoCm, dpi),
        photoHeightPx: cmAPx(medida.altoCm, dpi),
        marginPx: cmAPx(MARGEN_CM, dpi),
        gapPx: cmAPx(SEPARACION_CM, dpi),
      };
      const photoCanvas = createCroppedPhotoCanvas({
        image,
        crop,
        outputWidth: config.photoWidthPx,
        outputHeight: config.photoHeightPx,
        settings,
        rotation,
      });
      const grillaVista: Grilla = {
        ...grilla,
        startX: Math.round(grilla.startX * f),
        startY: Math.round(grilla.startY * f),
        gridWidth: Math.round(grilla.gridWidth * f),
        gridHeight: Math.round(grilla.gridHeight * f),
      };
      pintar(ref.current, generarPlanchaCanvas({ photoCanvas, config, grilla: grillaVista }));
    });
    return () => {
      activo = false;
    };
  }, [imageSrc, crop, rotation, settings, medida.anchoCm, medida.altoCm, hoja.anchoCm, hoja.altoCm, grilla]);

  return (
    <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-white p-2">
      <canvas ref={ref} className="mx-auto h-auto max-h-[70vh] max-w-full" aria-label={`Plancha ${hoja.etiqueta} con ${grilla.total} fotos`} />
    </div>
  );
}
