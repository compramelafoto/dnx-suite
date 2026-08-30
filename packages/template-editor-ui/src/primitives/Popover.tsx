"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useEditorThemeStyle } from "../theme-context";
import { cn } from "./cn";

type PopoverProps = {
  /** Texto del disparador. */
  label: ReactNode;
  /** Título del panel; si falta, no se dibuja encabezado. */
  title?: string;
  children: ReactNode;
  disabled?: boolean;
  /** Ancho del panel en píxeles. */
  width?: number;
  /** Alto máximo del panel; por encima aparece scroll interno. */
  maxHeight?: number;
  triggerClassName?: string;
  panelClassName?: string;
  "data-testid"?: string;
};

const VIEWPORT_MARGIN = 8;

/**
 * Un desplegable anclado a su botón.
 *
 * Las propiedades del bloque viven en la barra de arriba, que es una sola fila de alto fijo
 * con scroll horizontal. Lo que no entra en esa fila se abre acá, y no en un panel lateral:
 * la columna de la derecha es para las capas.
 *
 * Va por portal y no en posición absoluta porque la barra recorta su contenido
 * (`overflow-x`), y un panel dentro de ella quedaría cortado. Al salir por portal pierde los
 * tokens `--te-*`, así que los vuelve a declarar.
 */
export function Popover({
  label,
  title,
  children,
  disabled = false,
  width = 260,
  maxHeight = 420,
  triggerClassName,
  panelClassName,
  "data-testid": testId,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const themeStyle = useEditorThemeStyle();

  const place = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    // Pegado al borde inferior del botón y sin salirse por la derecha de la ventana.
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN),
    );
    setPosition({ top: rect.bottom + 6, left });
  }, [width]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    // El lienzo se mueve debajo: seguir al botón es más barato que recalcular en cada cuadro.
    const onReflow = () => place();

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, place]);

  // Cerrar al deshabilitarse evita dejar huérfano un panel cuya selección ya no existe.
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        data-testid={testId}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-7 shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-2 text-[11px] font-medium transition-colors",
          "disabled:cursor-not-allowed disabled:opacity-45",
          open
            ? "border-[color:var(--te-accent)] bg-[color:var(--te-accent-wash)] text-[color:var(--te-accent)]"
            : "border-[color:var(--te-line)] bg-[color:var(--te-surface)] text-[color:var(--te-ink)] hover:border-[color:var(--te-line-strong)] hover:bg-[color:var(--te-chrome)]",
          triggerClassName,
        )}
      >
        {label}
        <svg className="h-3 w-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && position
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={title}
              style={{
                ...themeStyle,
                position: "fixed",
                top: position.top,
                left: position.left,
                width,
                maxHeight,
              }}
              className={cn(
                "z-[210] overflow-y-auto overscroll-contain rounded-xl border border-[color:var(--te-line)] bg-[color:var(--te-surface)] p-3 shadow-xl",
                panelClassName,
              )}
            >
              {title ? (
                <p className="m-0 mb-2 text-[11px] font-semibold text-[color:var(--te-ink-muted)]">
                  {title}
                </p>
              ) : null}
              {children}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
