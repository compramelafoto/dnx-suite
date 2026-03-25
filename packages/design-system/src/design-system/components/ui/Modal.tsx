"use client";

import { useEffect, type CSSProperties } from "react";
import { createContext, useContext } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils";
import { radius, compositionSpacing } from "../../tokens";
import { useResolvedTheme } from "../../themes";

interface ModalContextValue {
  onClose: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

function useModalContext() {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error("Modal components must be used within Modal");
  return ctx;
}

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  /** Ancho máximo del panel (default 32rem, como el showroom) */
  maxWidth?: string;
  /** Alto máximo del panel */
  maxHeight?: string;
  /** z-index del overlay (p. ej. 100 para quedar sobre el dashboard) */
  zIndex?: number;
  /** Accesibilidad: id del elemento que etiqueta el diálogo */
  "aria-labelledby"?: string;
}

export function Modal({
  open,
  onClose,
  children,
  className,
  maxWidth = "32rem",
  maxHeight = "90vh",
  zIndex = 50,
  "aria-labelledby": ariaLabelledBy,
}: ModalProps) {
  const theme = useResolvedTheme();

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, onClose]);

  if (!open) return null;

  const overlay = (
    <ModalContext.Provider value={{ onClose }}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabelledBy}
        style={{
          position: "fixed",
          inset: 0,
          zIndex,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100dvh",
          padding: compositionSpacing.modal.paddingOverlay,
          overflowY: "auto",
          animation: "ds-modal-overlay-in 0.2s ease-out",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "rgba(0, 0, 0, 0.7)",
            backdropFilter: "blur(2px)",
            cursor: "default",
          }}
        />
        <div
          className={cn(className)}
          style={{
            position: "relative",
            zIndex: zIndex + 1,
            background: theme.surface.base,
            border: `1px solid ${theme.border.subtle}`,
            borderRadius: radius.modal,
            maxWidth,
            width: "100%",
            maxHeight,
            margin: "auto",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            animation: "ds-modal-content-in 0.25s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes ds-modal-overlay-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes ds-modal-content-in {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }
        .ds-modal-header-shell .ds-modal-close-btn:hover {
          background: var(--ds-modal-close-hover-bg);
          color: var(--ds-modal-close-fg);
        }
        .ds-modal-header-shell .ds-modal-close-btn:focus-visible {
          outline: 2px solid var(--ds-modal-close-focus);
          outline-offset: 2px;
        }
      `,
        }}
      />
    </ModalContext.Provider>
  );

  return createPortal(overlay, document.body);
}

interface ModalHeaderProps {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ModalHeader({ title, children, className, style }: ModalHeaderProps) {
  const theme = useResolvedTheme();
  const { onClose } = useModalContext();
  const m = compositionSpacing.modal;

  return (
    <div
      className={cn("ds-modal-header-shell", className)}
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) auto",
        alignItems: "center",
        columnGap: m.titleToCloseGap,
        boxSizing: "border-box",
        minHeight: m.headerMinHeight,
        padding: `${m.headerPaddingY} ${m.headerPaddingX}`,
        borderBottom: `1px solid ${theme.border.subtle}`,
        ["--ds-modal-close-hover-bg" as string]: theme.state.hover,
        ["--ds-modal-close-fg" as string]: theme.text.primary,
        ["--ds-modal-close-focus" as string]: theme.brand.primary,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: compositionSpacing.stack.tight,
          minWidth: 0,
        }}
      >
        {title ? (
          <h2
            id="modal-title"
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              lineHeight: 1.35,
              color: theme.text.primary,
              margin: 0,
              overflowWrap: "anywhere",
            }}
          >
            {title}
          </h2>
        ) : null}
        {children}
      </div>
      <button
        type="button"
        className="ds-modal-close-btn"
        onClick={onClose}
        aria-label="Cerrar"
        style={{
          boxSizing: "border-box",
          width: m.closeHitArea,
          height: m.closeHitArea,
          minWidth: m.closeHitArea,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: 0,
          padding: 0,
          border: "none",
          borderRadius: radius.button,
          background: "transparent",
          color: theme.text.secondary,
          cursor: "pointer",
          fontSize: m.closeGlyphSize,
          lineHeight: 1,
          transition: "background-color 0.15s ease, color 0.15s ease",
        }}
      >
        ×
      </button>
    </div>
  );
}

interface ModalBodyProps {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ModalBody({ children, className, style }: ModalBodyProps) {
  return (
    <div
      className={cn(className)}
      style={{
        padding: compositionSpacing.modal.bodyPadding,
        overflow: "auto",
        flex: 1,
        minHeight: 0,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

interface ModalFooterProps {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ModalFooter({ children, className, style }: ModalFooterProps) {
  const theme = useResolvedTheme();
  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        gap: compositionSpacing.modal.footerActionGap,
        padding: `${compositionSpacing.modal.footerPaddingY} ${compositionSpacing.modal.footerPaddingX}`,
        borderTop: `1px solid ${theme.border.subtle}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
