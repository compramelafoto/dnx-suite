"use client";

import { useEffect, useRef } from "react";
import { colocacionEnPantalla, type Papel } from "@/lib/impresion/encuadre";
import { colorBordeDe, type Receta } from "@/lib/impresion/receta";

/** Zona de seguridad (spec §6): lo que queda a menos de 3 mm del borde puede perderse al cortar. */
const SEGURIDAD_MM = 3;

function Guias({ papelMm }: { papelMm: Papel }) {
  const mx = (SEGURIDAD_MM / papelMm.anchoMm) * 100;
  const my = (SEGURIDAD_MM / papelMm.altoMm) * 100;
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`v${f}`} className="absolute bottom-0 top-0 border-l border-white/70" style={{ left: `${f * 100}%` }} />
      ))}
      {[1 / 3, 2 / 3].map((f) => (
        <div key={`h${f}`} className="absolute left-0 right-0 border-t border-white/70" style={{ top: `${f * 100}%` }} />
      ))}
      <div
        className="absolute border border-dashed border-sky-400/90"
        style={{ left: `${mx}%`, right: `${mx}%`, top: `${my}%`, bottom: `${my}%` }}
      />
    </div>
  );
}

/**
 * La foto sobre la silueta del papel real, sólo con CSS (rápido aunque haya 30 en la grilla).
 * En RECORTAR se ve la foto entera con lo que se corta sombreado; en ENCAJAR, el papel con su
 * borde del color elegido. Con `onArrastrar`/`onZoom` se mueve con el mouse (o el dedo) y la
 * rueda. Es para mirar y para decidir: el archivo lo arma el servidor desde el original.
 */
export function PapelConFoto({
  src,
  foto,
  receta,
  papelMm,
  lado,
  guias = false,
  onArrastrar,
  onZoom,
}: {
  src: string;
  /** La foto ya derecha, en píxeles del original (sólo importa la proporción). */
  foto: { ancho: number; alto: number };
  receta: Receta;
  /** El papel ya orientado como la receta. */
  papelMm: Papel;
  /** Lado del cuadro que contiene al papel, en px de pantalla. */
  lado: number;
  guias?: boolean;
  /** Cuánto se arrastró la foto, en fracciones del papel (positivo = derecha / abajo). */
  onArrastrar?: (dxPapel: number, dyPapel: number) => void;
  /** Más de 1 acerca, menos de 1 aleja. */
  onZoom?: (factor: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ x: number; y: number; id: number } | null>(null);
  const zoomRef = useRef(onZoom);
  useEffect(() => {
    zoomRef.current = onZoom;
  });
  const conZoom = Boolean(onZoom);
  // La rueda necesita `passive: false` para no mover la página mientras se hace zoom.
  useEffect(() => {
    const el = ref.current;
    if (!el || !conZoom) return;
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      zoomRef.current?.(Math.exp(-e.deltaY * 0.0015));
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, [conZoom]);

  const ap = papelMm.anchoMm / papelMm.altoMm;
  const util = lado * 0.82;
  const papel = ap >= 1 ? { ancho: util, alto: util / ap } : { ancho: util * ap, alto: util };
  const left = (lado - papel.ancho) / 2;
  const top = (lado - papel.alto) / 2;
  const c = colocacionEnPantalla(receta, foto, papel);
  const soltar = () => {
    arrastre.current = null;
  };

  return (
    <div
      ref={ref}
      role="img"
      aria-label={
        onArrastrar
          ? "La foto sobre el papel. Arrastrala para moverla; con la rueda del mouse la acercás o la alejás."
          : "La foto sobre el papel"
      }
      className={`relative select-none overflow-hidden rounded-[var(--fo-radius-sm)] bg-black/10 ${
        onArrastrar ? "cursor-grab touch-none active:cursor-grabbing" : ""
      }`}
      style={{ width: lado, height: lado }}
      onPointerDown={
        onArrastrar
          ? (e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              arrastre.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
            }
          : undefined
      }
      onPointerMove={
        onArrastrar
          ? (e) => {
              const a = arrastre.current;
              if (!a || a.id !== e.pointerId) return;
              onArrastrar((e.clientX - a.x) / papel.ancho, (e.clientY - a.y) / papel.alto);
              arrastre.current = { ...a, x: e.clientX, y: e.clientY };
            }
          : undefined
      }
      onPointerUp={soltar}
      onPointerCancel={soltar}
    >
      {/* El papel. En ENCAJAR, lo que no tapa la foto es el borde. */}
      <div
        className="absolute"
        style={{
          left,
          top,
          width: papel.ancho,
          height: papel.alto,
          background: receta.modo === "ENCAJAR" ? colorBordeDe(receta) : "#ffffff",
        }}
      />
      <div className="absolute" style={{ left: left + c.caja.left, top: top + c.caja.top, width: c.caja.width, height: c.caja.height }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- vista previa privada del original, servida por nuestra ruta */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
          style={{ width: c.foto.width, height: c.foto.height, transform: `translate(-50%, -50%) rotate(${c.foto.rotacion}deg)` }}
        />
      </div>
      {/* Afuera del papel, sombreado: es lo que se corta. */}
      <div
        aria-hidden
        className="pointer-events-none absolute"
        style={{
          left,
          top,
          width: papel.ancho,
          height: papel.alto,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          outline: "1px solid rgba(255,255,255,0.9)",
        }}
      >
        {guias ? <Guias papelMm={papelMm} /> : null}
      </div>
    </div>
  );
}
