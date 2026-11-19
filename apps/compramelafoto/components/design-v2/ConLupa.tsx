"use client";

import { useRef, useState, type ReactNode } from "react";

/**
 * Una lupa sobre una cara del librito: al pasar el mouse (o el dedo, si `conDedo`) aparece un
 * círculo con esa zona agrandada. La zona se vuelve a dibujar más grande (no se estira una
 * imagen), así el texto se lee nítido aunque el listado tenga letra chica.
 *
 * `dibujar(escala)` devuelve la cara dibujada a esa escala, con su esquina arriba a la izquierda.
 */
export default function ConLupa({
  ancho,
  alto,
  escala,
  dibujar,
  aumento = 2.5,
  diametro = 220,
  conDedo = false,
  activa = true,
  giro = 0,
  children,
}: {
  /** Tamaño de la cara en sus unidades (las del lienzo de la plantilla). */
  ancho: number;
  alto: number;
  /** A qué escala se está mostrando la cara (la de `children`). */
  escala: number;
  dibujar: (escala: number) => ReactNode;
  /** Cuánto agranda la lupa respecto de lo que se ve. */
  aumento?: number;
  diametro?: number;
  /** También con el dedo (en el celular, apoyar y arrastrar). */
  conDedo?: boolean;
  activa?: boolean;
  /** Si la cara se muestra girada (en grados, a favor del reloj): para ubicar bien la lupa. */
  giro?: 0 | 90 | 180 | 270;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [punto, setPunto] = useState<{ x: number; y: number; dedo: boolean } | null>(null);

  function mover(e: React.PointerEvent) {
    if (!activa) return;
    if (e.pointerType !== "mouse" && !conDedo) return;
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    // El rectángulo de una cara girada es el de la vista girada: se vuelve a las coordenadas de la cara.
    const u = e.clientX - r.left;
    const v = e.clientY - r.top;
    const A = ancho * escala;
    const H = alto * escala;
    const [x, y] =
      giro === 90 ? [v, H - u] : giro === 180 ? [A - u, H - v] : giro === 270 ? [A - v, u] : [u, v];
    if (x < 0 || y < 0 || x > A || y > H) return setPunto(null);
    setPunto({ x, y, dedo: e.pointerType !== "mouse" });
  }

  const grande = escala * aumento;
  const radio = diametro / 2;
  // Con el dedo, la lupa va arriba del dedo para que no la tape.
  const arribaDelDedo = punto?.dedo && giro === 0 ? radio + 40 : 0;

  return (
    <div
      ref={ref}
      className="relative"
      style={{ width: ancho * escala, height: alto * escala, touchAction: activa && conDedo ? "none" : undefined }}
      onPointerMove={mover}
      onPointerDown={(e) => {
        if (activa && conDedo && e.pointerType !== "mouse") {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          mover(e);
        }
      }}
      onPointerUp={(e) => {
        if (e.pointerType !== "mouse") setPunto(null);
      }}
      onPointerLeave={() => setPunto(null)}
      onPointerCancel={() => setPunto(null)}
    >
      {children}
      {activa && punto ? (
        <div
          aria-hidden
          className="pointer-events-none absolute z-30 overflow-hidden rounded-full border-[3px] border-white bg-white shadow-[0_6px_24px_rgba(0,0,0,.35)] ring-1 ring-black/20"
          style={{
            width: diametro,
            height: diametro,
            left: punto.x - radio,
            top: punto.y - radio - arribaDelDedo,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: radio - punto.x * aumento,
              top: radio - punto.y * aumento,
              width: ancho * grande,
              height: alto * grande,
            }}
          >
            {dibujar(grande)}
          </div>
        </div>
      ) : null}
    </div>
  );
}
