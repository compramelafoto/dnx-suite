"use client";

import { useEffect, useRef, useState } from "react";
import { aplicarAjustes, type Ajustes } from "@/lib/impresion/ajustes";
import type { PixelesRecorte } from "./recorte";

/** Ancho interno del canvas de la vista previa (se ve más chico; así queda nítido en pantallas densas). */
const ANCHO_VISTA_PX = 480;

/** La vista previa del servidor, ya cargada, para dibujarla una y otra vez sin volver a pedirla. */
function useImagen(src: string): HTMLImageElement | null {
  const [cargada, setCargada] = useState<{ src: string; img: HTMLImageElement } | null>(null);
  useEffect(() => {
    let activo = true;
    const img = new Image();
    img.onload = () => {
      if (activo) setCargada({ src, img });
    };
    img.src = src;
    return () => {
      activo = false;
    };
  }, [src]);
  return cargada?.src === src ? cargada.img : null;
}

/**
 * Así queda cada foto: el recorte de la vista previa (1600 px) con el giro y los ajustes. Es SÓLO
 * para mirar: el archivo que se imprime lo arma el servidor desde el original.
 */
export function VistaRecorte({
  imageSrc,
  crop,
  rotacion,
  ajustes,
  medida,
}: {
  imageSrc: string;
  crop: PixelesRecorte;
  rotacion: number;
  ajustes: Ajustes;
  medida: { anchoCm: number; altoCm: number };
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const img = useImagen(imageSrc);
  const ancho = ANCHO_VISTA_PX;
  const alto = Math.max(1, Math.round((ANCHO_VISTA_PX * medida.altoCm) / medida.anchoCm));

  useEffect(() => {
    if (!img) return;
    // Un dibujo por cuadro como mucho: mover un control no recalcula en cada evento.
    const id = requestAnimationFrame(() => {
      const canvas = ref.current;
      const ctx = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !ctx) return;
      canvas.width = ancho;
      canvas.height = alto;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, ancho, alto);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      // Los píxeles del recorte son de la caja que ocupa la foto girada (igual que react-easy-crop).
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      const rad = (rotacion * Math.PI) / 180;
      const cajaAncho = w * Math.abs(Math.cos(rad)) + h * Math.abs(Math.sin(rad));
      const cajaAlto = w * Math.abs(Math.sin(rad)) + h * Math.abs(Math.cos(rad));
      ctx.scale(ancho / crop.width, alto / crop.height);
      ctx.translate(-crop.x + cajaAncho / 2, -crop.y + cajaAlto / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2);
      const datos = ctx.getImageData(0, 0, ancho, alto);
      aplicarAjustes(datos.data, 4, ajustes);
      ctx.putImageData(datos, 0, 0);
    });
    return () => cancelAnimationFrame(id);
  }, [img, crop, rotacion, ajustes, ancho, alto]);

  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--fo-muted)]">Así queda cada foto</p>
      <div
        className="mx-auto w-full max-w-xs rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-white p-3"
        style={{ aspectRatio: `${medida.anchoCm} / ${medida.altoCm}` }}
      >
        <canvas ref={ref} className="h-full w-full" aria-label="Vista previa de la foto recortada y retocada" />
      </div>
    </div>
  );
}

/** La hoja que armó el servidor: es el mismo archivo que se imprime o se descarga. */
export function VistaHoja({ hojaId, version, fotos }: { hojaId: string; version: number; fotos: number }) {
  return (
    <div className="rounded-[var(--fo-radius-sm)] border border-[var(--fo-border)] bg-white p-2">
      {/* eslint-disable-next-line @next/next/no-img-element -- archivo privado de la plancha, servido por nuestra ruta */}
      <img
        src={`/api/impresion/hoja/${hojaId}?v=${version}`}
        alt={`Plancha con ${fotos} fotos`}
        className="mx-auto h-auto max-h-[70vh] max-w-full"
      />
    </div>
  );
}
