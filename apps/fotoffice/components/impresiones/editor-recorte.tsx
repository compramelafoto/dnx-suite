"use client";

import { useEffect, useRef } from "react";
import { orientarTamano, recorteInicial, type Recorte } from "@/lib/impresiones/recorte";

const ZOOM_MAX = 3;
const PASO_TECLA = 0.02;

const entre = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/**
 * Lleva un recorte a los límites de la foto: nunca más grande que la foto, nunca afuera. Así
 * `recorteValido` siempre da true y la proporción (la del tamaño) no cambia.
 */
export function ajustarRecorte(r: Recorte, base: Recorte): Recorte {
  // El zoom se mide contra el recorte más grande posible (`base`): w/h nunca superan los de la base.
  const escala = entre(r.w / base.w, 1 / ZOOM_MAX, 1);
  const w = base.w * escala;
  const h = base.h * escala;
  return { x: entre(r.x, 0, 1 - w), y: entre(r.y, 0, 1 - h), w, h };
}

/** Acerca o aleja (1× = el recorte más grande) sin mover el centro. */
function conZoom(actual: Recorte, b: Recorte, z: number): Recorte {
  const zz = entre(z, 1, ZOOM_MAX);
  const w = b.w / zz;
  const h = b.h / zz;
  const cx = actual.x + actual.w / 2;
  const cy = actual.y + actual.h / 2;
  return ajustarRecorte({ x: cx - w / 2, y: cy - h / 2, w, h }, b);
}

/**
 * Elegir qué parte de la foto entra en la copia. El marco tiene la proporción del tamaño (girado para
 * acompañar a la foto) y la foto se mueve detrás: se arrastra con el dedo o el mouse, se agranda con
 * el control «Zoom» (o la rueda) y también se mueve con las flechas del teclado.
 */
export function EditorRecorte({
  src,
  fotoW,
  fotoH,
  tamW,
  tamH,
  valor,
  onCambio,
  etiqueta = "Recorte de la foto",
}: {
  src: string;
  fotoW: number;
  fotoH: number;
  tamW: number;
  tamH: number;
  valor: Recorte;
  onCambio: (r: Recorte) => void;
  etiqueta?: string;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const arrastre = useRef<{ id: number; px: number; py: number; r: Recorte } | null>(null);
  const t = orientarTamano(fotoW, fotoH, tamW, tamH);
  const base = recorteInicial(fotoW, fotoH, tamW, tamH);
  const r = ajustarRecorte(valor, base);
  const zoom = base.w / r.w;

  // Los últimos valores, para el oyente de la rueda (que se registra una sola vez).
  const ultimo = useRef({ r, base, onCambio });
  useEffect(() => {
    ultimo.current = { r, base, onCambio };
  });

  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    // No pasivo: la rueda agranda la foto en vez de mover la página.
    const rueda = (e: WheelEvent) => {
      e.preventDefault();
      const { r: actual, base: b, onCambio: cambiar } = ultimo.current;
      const z = b.w / actual.w;
      cambiar(conZoom(actual, b, z * (e.deltaY < 0 ? 1.08 : 1 / 1.08)));
    };
    el.addEventListener("wheel", rueda, { passive: false });
    return () => el.removeEventListener("wheel", rueda);
  }, []);

  function alBajar(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    arrastre.current = { id: e.pointerId, px: e.clientX, py: e.clientY, r };
  }
  function alMover(e: React.PointerEvent<HTMLDivElement>) {
    const a = arrastre.current;
    const el = marco.current;
    if (!a || a.id !== e.pointerId || !el) return;
    const caja = el.getBoundingClientRect();
    if (caja.width === 0 || caja.height === 0) return;
    // Mover la foto a la derecha es mostrar lo que está más a la izquierda.
    const dx = ((e.clientX - a.px) / caja.width) * a.r.w;
    const dy = ((e.clientY - a.py) / caja.height) * a.r.h;
    onCambio(ajustarRecorte({ ...a.r, x: a.r.x - dx, y: a.r.y - dy }, base));
  }
  function alSoltar(e: React.PointerEvent<HTMLDivElement>) {
    if (arrastre.current?.id === e.pointerId) arrastre.current = null;
  }
  function alTeclear(e: React.KeyboardEvent<HTMLDivElement>) {
    const mov: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const m = mov[e.key];
    if (m) {
      e.preventDefault();
      onCambio(ajustarRecorte({ ...r, x: r.x + m[0] * PASO_TECLA * r.w, y: r.y + m[1] * PASO_TECLA * r.h }, base));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      onCambio(conZoom(r, base, zoom * 1.1));
    } else if (e.key === "-") {
      e.preventDefault();
      onCambio(conZoom(r, base, zoom / 1.1));
    }
  }

  return (
    <div className="space-y-3">
      <div
        ref={marco}
        role="application"
        aria-label={`${etiqueta}. Arrastrá la foto o usá las flechas para moverla; + y − para acercar o alejar.`}
        tabIndex={0}
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alSoltar}
        onKeyDown={alTeclear}
        className="relative mx-auto w-full max-w-md cursor-grab touch-none select-none overflow-hidden rounded-[var(--fo-radius-sm)] bg-black outline-none ring-[var(--fo-accent)] focus-visible:ring-2 active:cursor-grabbing"
        style={{ aspectRatio: `${t.w} / ${t.h}` }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- miniatura firmada de la carpeta */}
        <img
          src={src}
          alt=""
          draggable={false}
          className="pointer-events-none absolute max-w-none"
          style={{
            width: `${100 / r.w}%`,
            height: `${100 / r.h}%`,
            left: `${-(r.x / r.w) * 100}%`,
            top: `${-(r.y / r.h) * 100}%`,
          }}
        />
        <div className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3" aria-hidden>
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} className="border border-white/20" />
          ))}
        </div>
      </div>
      <label className="mx-auto flex max-w-md items-center gap-3 text-sm">
        <span className="shrink-0 text-[var(--fo-text-secondary)]">Zoom</span>
        <input
          type="range"
          min={1}
          max={ZOOM_MAX}
          step={0.01}
          value={zoom}
          onChange={(e) => onCambio(conZoom(r, base, Number(e.target.value)))}
          className="w-full accent-[var(--fo-accent)]"
          aria-valuetext={`${zoom.toFixed(1).replace(".", ",")} veces`}
        />
        <span className="w-10 shrink-0 text-right tabular-nums text-[var(--fo-muted)]">{zoom.toFixed(1).replace(".", ",")}×</span>
      </label>
    </div>
  );
}
