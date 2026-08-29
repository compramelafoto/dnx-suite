"use client";

import { ReactNode, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { useEditorThemeStyle } from "../theme-context";

export type AppModalSize = "sm" | "md" | "lg" | "xl";

const SIZE_CAP_REM: Record<AppModalSize, string> = {
  sm: "40rem",
  md: "42rem",
  lg: "56rem",
  xl: "72rem",
};

const SIZE_MAX_CLASS: Record<AppModalSize, string> = {
  sm: "max-w-[40rem]",
  md: "max-w-2xl",
  lg: "max-w-4xl",
  xl: "max-w-6xl",
};

export type AppModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Default del design system: lg (max-w-4xl) */
  size?: AppModalSize;
  title?: string;
  description?: ReactNode;
  /** Si hay `title`, se usa como id del heading (accesibilidad) */
  titleId?: string;
  ariaLabelledBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  panelClassName?: string;
  overlayClassName?: string;
  zIndexClass?: string;
  /** Clases extra en el área scroll del cuerpo (p. ej. `ds-modal-scroll--padded`). */
  contentClassName?: string;
  /** Ancho máximo del panel (rem). Si se define, pisa el tope del `size` para modales muy anchos. */
  maxWidthCapRem?: string;
};

export default function AppModal({
  open,
  onClose,
  children,
  size = "lg",
  title,
  description,
  titleId = "app-modal-title",
  ariaLabelledBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
  showCloseButton = true,
  panelClassName,
  overlayClassName,
  zIndexClass = "z-[80]",
  contentClassName,
  maxWidthCapRem,
}: AppModalProps) {
  const [mounted, setMounted] = useState(false);
  // El portal sale del árbol del editor: sin esto los tokens `--te-*` no llegan.
  const themeStyle = useEditorThemeStyle();
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !closeOnEscape) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closeOnEscape, onClose]);

  if (!mounted || !open) return null;

  const cap = maxWidthCapRem ?? SIZE_CAP_REM[size];
  const labelledBy = ariaLabelledBy ?? (title ? titleId : undefined);

  return createPortal(
    <div
      className={cn("fixed inset-0 overflow-y-auto overscroll-contain", zIndexClass)}
      style={themeStyle}
      role="presentation"
    >
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        className={cn(
          "fixed inset-0 z-0 cursor-default border-0 bg-black/50 p-0",
          !closeOnBackdrop ? "pointer-events-none" : null,
          overlayClassName,
        )}
        onMouseDown={() => {
          if (!closeOnBackdrop) return;
          onClose();
        }}
      />
      <div className="relative z-[1] flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          className={cn(
            "relative box-border flex w-full max-h-[min(92vh,900px)] shrink-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--te-line)] bg-white text-left shadow-xl",
            SIZE_MAX_CLASS[size],
            panelClassName,
          )}
          style={{
            width: `min(calc(100vw - 2rem), ${cap})`,
            minWidth: "min(100%, 20rem)",
          }}
          onMouseDown={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
        >
          {title != null || description != null || showCloseButton ? (
            <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[color:var(--te-line)] px-5 py-4 sm:px-6">
              <div className="min-w-0 flex-1 overflow-hidden">
                {title ? (
                  <h2 id={titleId} className="text-base font-semibold text-[color:var(--te-ink)] sm:text-lg">
                    {title}
                  </h2>
                ) : null}
                {description ? (
                  <div className="mt-1 text-xs leading-relaxed text-[color:var(--te-ink-muted)] sm:text-sm">
                    {description}
                  </div>
                ) : null}
              </div>
              {showCloseButton ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full text-[color:var(--te-ink-muted)] transition-colors hover:bg-[color:var(--te-chrome-sunken)] hover:text-[color:var(--te-ink)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--te-ink-faint)] focus-visible:ring-offset-2"
                  aria-label="Cerrar"
                >
                  <X className="h-5 w-5" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="ds-modal-frame flex min-h-0 min-w-0 flex-1 flex-col">
            <div
              className={cn(
                "ds-modal-scroll flex min-h-0 min-w-0 flex-1 flex-col",
                contentClassName,
              )}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
