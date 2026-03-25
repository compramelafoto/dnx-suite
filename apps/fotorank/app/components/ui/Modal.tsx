"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  /**
   * Isologo FotoRank **encima del título** (solo flujos de marca: onboarding, bienvenida).
   * Por defecto `false`: modales funcionales (login, decisión, edición) no llevan logo en el panel.
   */
  showTopLogo?: boolean;
  /** Padding del área scrollable (default = design_rule; compact = wizard) */
  contentPadding?: "default" | "compact" | "flush";
  /** "full" = title + close, "minimal" = solo botón cerrar, "none" = sin header */
  header?: "full" | "minimal" | "none";
  /** z-index para modales anidados (ej. asistente dentro del wizard) */
  zIndex?: number;
  /** Título centrado y tipografía grande (misma línea que shell de login). */
  centeredHeader?: boolean;
}

const maxWidthClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "xl",
  header = "full",
  zIndex = 50,
  showTopLogo = true,
  contentPadding = "default",
  centeredHeader = false,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [isOpen, handleEscape]);

  const contentPadClass =
    contentPadding === "compact"
      ? "fr-modal-content--compact"
      : contentPadding === "flush"
        ? "fr-modal-content--flush"
        : "";

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 flex min-h-[100dvh] items-center justify-center overflow-y-auto p-4 sm:p-6"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-black/78 backdrop-blur-sm"
        aria-hidden="true"
      />
      <div
        className={`fr-modal relative z-10 mx-auto my-auto flex w-full max-h-[min(90vh,100dvh-2rem)] flex-col overflow-hidden rounded-2xl border border-[#3a3327] bg-[#0b0d12] ${showTopLogo ? "fr-modal--with-brand" : ""} ${maxWidthClasses[maxWidth]}`}
        style={{
          boxShadow:
            "0 0 0 1px rgba(212,175,55,0.08), 0 22px 80px rgba(0,0,0,0.72), 0 0 60px rgba(212,175,55,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {showTopLogo ? (
          <div className="fr-modal-brand">
            <img src="/fotorank-isologo.png" alt="FotoRank" className="fr-modal-brand__img" />
          </div>
        ) : null}
        {(header === "full" || header === "minimal") &&
          (centeredHeader && header === "full" && title ? (
            <div className="fr-modal-header fr-modal-header--centered shrink-0">
              <div className="fr-modal-header__gutter" aria-hidden="true" />
              <h2 id="modal-title" className="fr-modal-header__title fr-modal-header__title--center tracking-tight">
                {title}
              </h2>
              <div className="fr-modal-header__close-slot">
                <button type="button" onClick={onClose} className="fr-modal-close" aria-label="Cerrar">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          ) : (
            <div className="fr-modal-header shrink-0">
              <div className="fr-modal-header__title-track">
                {header === "full" && title ? (
                  <h2 id="modal-title" className="fr-modal-header__title">
                    {title}
                  </h2>
                ) : null}
              </div>
              <button type="button" onClick={onClose} className="fr-modal-close" aria-label="Cerrar">
                <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        <div className={`fr-modal-content min-h-0 flex-1 overflow-y-auto ${contentPadClass}`.trim()}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
}
