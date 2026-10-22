"use client";

import { useEffect, useRef } from "react";
import {
  DEFAULT_PHOTO_CROP,
  PHOTO_CROP_MAX_ZOOM,
  normalizePhotoCrop,
  type PhotoCrop,
  type TemplateV2Block,
} from "@repo/template-editor-core";
import { useNaturalImageSize } from "./inspector/ImageCropSection";

/**
 * Modo "encuadrar": el marco queda quieto y la foto se mueve adentro.
 *
 * Se entra con doble clic sobre una foto, como en los diseñadores de fotolibro. Arrastrar corre
 * la foto, la rueda la acerca o la aleja, y se sale con Esc, Enter o un clic fuera del marco.
 * Mientras dura, la parte de la foto que queda fuera del marco se ve en transparencia: así se
 * sabe cuánto margen hay para correrla.
 */

type Props = {
  block: TemplateV2Block;
  /** Zoom del lienzo: convierte el movimiento del mouse en píxeles de la hoja. */
  canvasZoom: number;
  onCrop: (crop: PhotoCrop, natural: { w: number; h: number }) => void;
  onExit: () => void;
};

/** Dónde va la foto entera, en coordenadas del marco. Misma cuenta que la impresión. */
function ubicar(boxW: number, boxH: number, aspecto: number, crop: PhotoCrop) {
  const ancho = Math.max(boxW, boxH * aspecto) * crop.zoom;
  const alto = ancho / aspecto;
  const sobraX = ancho - boxW;
  const sobraY = alto - boxH;
  return {
    x: -sobraX / 2 - (crop.x * sobraX) / 2,
    y: -sobraY / 2 - (crop.y * sobraY) / 2,
    width: ancho,
    height: alto,
    sobraX,
    sobraY,
  };
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function ImageCropOverlay({ block, canvasZoom, onCrop, onExit }: Props) {
  const cfg = block.configJson;
  // La vista liviana si la hay (fotolibro): misma proporción que el original, carga mucho más rápido.
  const src = String((typeof cfg.previewSrc === "string" && cfg.previewSrc) || cfg.src || "");
  const natural = useNaturalImageSize(src);
  const crop = cfg.crop ? normalizePhotoCrop(cfg.crop) : DEFAULT_PHOTO_CROP;
  const { width: boxW, height: boxH, rotation = 0 } = block.layout;
  const rootRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; crop: PhotoCrop } | null>(null);

  // Lo último que se vio, para los listeners nativos (rueda, teclado), que no se rearman en cada cuadro.
  const latest = useRef({ crop, natural, onCrop, onExit });
  latest.current = { crop, natural, onCrop, onExit };

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      // Ctrl/⌘ + rueda sigue siendo el zoom del lienzo.
      if (e.ctrlKey || e.metaKey) return;
      e.preventDefault();
      e.stopPropagation();
      const { crop: actual, natural: nat, onCrop: cambiar } = latest.current;
      if (!nat) return;
      const delta = Math.max(-60, Math.min(60, e.deltaY));
      const zoom = clamp(actual.zoom * Math.exp(-delta * 0.004), 1, PHOTO_CROP_MAX_ZOOM);
      cambiar({ ...actual, zoom }, nat);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        latest.current.onExit();
      }
    }
    function onPointerDownFuera(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) latest.current.onExit();
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("pointerdown", onPointerDownFuera, true);
    return () => {
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("pointerdown", onPointerDownFuera, true);
    };
  }, []);

  const aspecto = natural ? natural.w / natural.h : null;
  const u = aspecto ? ubicar(boxW, boxH, aspecto, crop) : null;

  return (
    <div
      ref={rootRef}
      role="application"
      aria-label="Encuadrar la foto: arrastrá para correrla, rueda para acercar, Esc para terminar"
      style={{
        position: "absolute",
        left: block.layout.x,
        top: block.layout.y,
        width: boxW,
        height: boxH,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        zIndex: 100_000,
        cursor: drag.current ? "grabbing" : "grab",
        touchAction: "none",
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onExit();
      }}
      // El clic que cierra un arrastre no tiene que llegar al fondo: lo deselecciona todo y el
      // encuadre se cerraba al soltar la foto.
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.preventDefault();
        drag.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY, crop };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d || d.pointerId !== e.pointerId || !natural || !aspecto) return;
        const z = canvasZoom > 0 ? canvasZoom : 1;
        // El movimiento en pantalla, llevado a los ejes del marco (que puede estar girado).
        const rad = (-rotation * Math.PI) / 180;
        const dxPantalla = (e.clientX - d.x) / z;
        const dyPantalla = (e.clientY - d.y) / z;
        const dx = dxPantalla * Math.cos(rad) - dyPantalla * Math.sin(rad);
        const dy = dxPantalla * Math.sin(rad) + dyPantalla * Math.cos(rad);
        const base = ubicar(boxW, boxH, aspecto, d.crop);
        onCrop(
          {
            zoom: d.crop.zoom,
            x: base.sobraX > 0 ? clamp(d.crop.x - (2 * dx) / base.sobraX, -1, 1) : 0,
            y: base.sobraY > 0 ? clamp(d.crop.y - (2 * dy) / base.sobraY, -1, 1) : 0,
          },
          natural,
        );
      }}
      onPointerUp={(e) => {
        if (drag.current?.pointerId === e.pointerId) drag.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* noop */
        }
      }}
    >
      {u ? (
        /* La foto entera, en transparencia: lo que queda fuera del marco no se imprime. */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          draggable={false}
          style={{
            position: "absolute",
            left: u.x,
            top: u.y,
            width: u.width,
            height: u.height,
            maxWidth: "none",
            opacity: 0.35,
            pointerEvents: "none",
            /*
             * Sólo afuera del marco: adentro ya se ve la foto real, y la transparencia encima la
             * duplicaba. El agujero se recorta con la regla par-impar.
             */
            clipPath: `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${-u.x}px ${-u.y}px, ${-u.x + boxW}px ${-u.y}px, ${-u.x + boxW}px ${-u.y + boxH}px, ${-u.x}px ${-u.y + boxH}px, ${-u.x}px ${-u.y}px)`,
            outline: "1px solid rgba(37,99,235,0.6)",
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          outline: "2px solid #2563eb",
          outlineOffset: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
