"use client";

import { joystickVector, sendSimulatorKey, tapSimulatorKey, touchInput } from "@/lib/simulator/touch-input";
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

/** Radio del joystick (px): hasta ahí se empuja; al borde se corre. */
const STICK_RADIUS = 56;
/** Un toque (no arrastre) en la zona de mirar enfoca, como apretar C. */
const TAP_MAX_MOVE = 10;
const TAP_MAX_MS = 280;

interface StickState {
  id: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

interface LookState {
  id: number;
  lastX: number;
  lastY: number;
  startX: number;
  startY: number;
  startMs: number;
}

/** Botón que mantiene apretada una tecla mientras el dedo está encima (subir y bajar la cámara). */
function HoldButton({ code, label, children }: { code: string; label: string; children: React.ReactNode }) {
  const down = useRef(false);
  const release = () => {
    if (!down.current) return;
    down.current = false;
    sendSimulatorKey(code, "keyup");
  };
  return (
    <button
      type="button"
      className="cod-touch__btn"
      aria-label={label}
      onPointerDown={(e) => {
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        down.current = true;
        sendSimulatorKey(code, "keydown");
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
    >
      {children}
    </button>
  );
}

/** Botón de un toque que dispara un atajo de teclado del simulador. */
function TapButton({ code, label, className = "", children }: { code: string; label: string; className?: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      className={`cod-touch__btn ${className}`}
      aria-label={label}
      onPointerDown={(e) => {
        e.stopPropagation();
        tapSimulatorKey(code);
      }}
    >
      {children}
    </button>
  );
}

/**
 * Controles de juego para el celular, encima del visor: pulgar izquierdo
 * camina (el joystick aparece donde se apoya), el resto de la pantalla mira
 * arrastrando y enfoca con un toque, y a la derecha están el obturador, el
 * foco, el zoom, subir/bajar la cámara y los ajustes.
 */
export default function TouchGameControls({ onOpenPanel }: { onOpenPanel: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const stick = useRef<StickState | null>(null);
  const look = useRef<LookState | null>(null);
  const [stickView, setStickView] = useState<StickState | null>(null);

  useEffect(() => {
    touchInput.active = true;
    return () => {
      touchInput.active = false;
      touchInput.moveX = 0;
      touchInput.moveY = 0;
    };
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const leftSide = e.clientX - rect.left < rect.width * 0.42;
    if (leftSide && !stick.current) {
      stick.current = { id: e.pointerId, originX: e.clientX, originY: e.clientY, x: e.clientX, y: e.clientY };
      setStickView({ ...stick.current });
      return;
    }
    if (!look.current) {
      look.current = { id: e.pointerId, lastX: e.clientX, lastY: e.clientY, startX: e.clientX, startY: e.clientY, startMs: performance.now() };
    }
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const s = stick.current;
    if (s && s.id === e.pointerId) {
      s.x = e.clientX;
      s.y = e.clientY;
      const v = joystickVector(s.x - s.originX, s.y - s.originY, STICK_RADIUS);
      touchInput.moveX = v.x;
      touchInput.moveY = v.y;
      setStickView({ ...s });
      return;
    }
    const l = look.current;
    if (l && l.id === e.pointerId) {
      touchInput.lookDX += e.clientX - l.lastX;
      touchInput.lookDY += e.clientY - l.lastY;
      l.lastX = e.clientX;
      l.lastY = e.clientY;
    }
  };

  const onPointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (stick.current?.id === e.pointerId) {
      stick.current = null;
      touchInput.moveX = 0;
      touchInput.moveY = 0;
      setStickView(null);
      return;
    }
    const l = look.current;
    if (l && l.id === e.pointerId) {
      look.current = null;
      const moved = Math.hypot(e.clientX - l.startX, e.clientY - l.startY);
      if (e.type === "pointerup" && moved < TAP_MAX_MOVE && performance.now() - l.startMs < TAP_MAX_MS) tapSimulatorKey("KeyC");
    }
  };

  const knob = stickView ? joystickVector(stickView.x - stickView.originX, stickView.y - stickView.originY, STICK_RADIUS) : null;

  return (
    <div
      ref={rootRef}
      className="cod-touch"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onContextMenu={(e) => e.preventDefault()}
    >
      {stickView && knob ? (
        <div className="cod-touch__stick" style={{ left: stickView.originX - (rootRef.current?.getBoundingClientRect().left ?? 0), top: stickView.originY - (rootRef.current?.getBoundingClientRect().top ?? 0) }}>
          <div className="cod-touch__knob" style={{ transform: `translate(${knob.x * STICK_RADIUS}px, ${-knob.y * STICK_RADIUS}px)` }} />
        </div>
      ) : (
        <div className="cod-touch__stick cod-touch__stick--hint" aria-hidden="true">
          <div className="cod-touch__knob" />
        </div>
      )}

      <button
        type="button"
        className="cod-touch__btn cod-touch__settings"
        aria-label="Ajustes de cámara"
        onPointerDown={(e) => {
          e.stopPropagation();
          onOpenPanel();
        }}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h10M18 7h2M4 17h4M12 17h8" />
          <circle cx="16" cy="7" r="2" />
          <circle cx="10" cy="17" r="2" />
        </svg>
      </button>

      <div className="cod-touch__right">
        <div className="cod-touch__row">
          <HoldButton code="KeyI" label="Subir la cámara">
            ▲
          </HoldButton>
          <TapButton code="KeyZ" label="Acercar (zoom)">
            +
          </TapButton>
        </div>
        <div className="cod-touch__row">
          <HoldButton code="KeyK" label="Bajar la cámara">
            ▼
          </HoldButton>
          <TapButton code="KeyX" label="Alejar (zoom)">
            −
          </TapButton>
        </div>
        <div className="cod-touch__row">
          <TapButton code="KeyC" label="Enfocar" className="cod-touch__btn--af">
            AF
          </TapButton>
          <TapButton code="Space" label="Sacar la foto" className="cod-touch__shutter">
            <span />
          </TapButton>
        </div>
      </div>
    </div>
  );
}
