"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Recuadro para dibujar la firma con el dedo o el mouse (eventos de puntero, sin librerías). Entrega el
 * trazo como PNG con fondo transparente de 600×200 (`onChange(dataUrl)`), o `null` si está vacío. El
 * servidor igual lo vuelve a validar: acá sólo se evita mandar un recuadro en blanco.
 */
const ANCHO = 600;
const ALTO = 200;
/** Trazo mínimo (en puntos) para considerar que hay una firma. */
const PUNTOS_MIN = 25;

export function FirmaCanvas({ onChange, disabled = false }: { onChange: (dataUrl: string | null) => void; disabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const dibujando = useRef(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const puntos = useRef(0);
  const [hayTrazo, setHayTrazo] = useState(false);

  const contexto = useCallback(() => {
    const c = ref.current?.getContext("2d");
    if (c) {
      c.lineWidth = 3;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.strokeStyle = "#111111";
    }
    return c ?? null;
  }, []);

  useEffect(() => {
    contexto();
  }, [contexto]);

  function punto(e: React.PointerEvent<HTMLCanvasElement>) {
    const c = ref.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * ANCHO) / r.width, y: ((e.clientY - r.top) * ALTO) / r.height };
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (disabled) return;
    e.preventDefault();
    ref.current?.setPointerCapture(e.pointerId);
    dibujando.current = true;
    const p = punto(e);
    ultimo.current = p;
    // Un toque suelto también deja un punto.
    const c = contexto();
    if (c) {
      c.beginPath();
      c.moveTo(p.x, p.y);
      c.lineTo(p.x + 0.01, p.y + 0.01);
      c.stroke();
    }
    puntos.current += 1;
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current || disabled) return;
    e.preventDefault();
    const c = contexto();
    const p = punto(e);
    if (c && ultimo.current) {
      c.beginPath();
      c.moveTo(ultimo.current.x, ultimo.current.y);
      c.lineTo(p.x, p.y);
      c.stroke();
    }
    ultimo.current = p;
    puntos.current += 1;
  }

  function terminar(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return;
    e.preventDefault();
    dibujando.current = false;
    ultimo.current = null;
    if (puntos.current >= PUNTOS_MIN && ref.current) {
      setHayTrazo(true);
      onChange(ref.current.toDataURL("image/png"));
    }
  }

  function limpiar() {
    const c = ref.current;
    c?.getContext("2d")?.clearRect(0, 0, ANCHO, ALTO);
    puntos.current = 0;
    dibujando.current = false;
    ultimo.current = null;
    setHayTrazo(false);
    onChange(null);
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={ref}
        width={ANCHO}
        height={ALTO}
        aria-label="Recuadro para dibujar tu firma"
        className="w-full touch-none rounded border bg-white"
        style={{ touchAction: "none", aspectRatio: `${ANCHO} / ${ALTO}`, cursor: disabled ? "not-allowed" : "crosshair" }}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={terminar}
        onPointerCancel={terminar}
        onPointerLeave={terminar}
      />
      <div className="flex items-center justify-between text-sm">
        <span className="opacity-70">{hayTrazo ? "Firma lista." : "Dibujá tu firma con el dedo o el mouse."}</span>
        <button type="button" onClick={limpiar} disabled={disabled} className="fo-btn fo-btn-secondary text-sm">
          Borrar y empezar de nuevo
        </button>
      </div>
    </div>
  );
}
