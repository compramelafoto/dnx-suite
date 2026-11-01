"use client";

import type { CSSProperties } from "react";

import { startGuidedTour } from "./events";

export type TourHelpButtonProps = {
  tourId: string;
  /** Texto visible; con `iconOnly` queda como etiqueta accesible. */
  label?: string;
  iconOnly?: boolean;
  className?: string;
  style?: CSSProperties;
  title?: string;
};

/**
 * Botón "Ayuda" que vuelve a abrir el recorrido de la pantalla. Lleva `data-tour="ayuda"`
 * para que el último paso de cada recorrido pueda señalarlo.
 * Sin `className` usa un estilo neutro propio; con `className` lo pinta la app.
 */
export function TourHelpButton({ tourId, label = "Ayuda", iconOnly = false, className, style, title }: TourHelpButtonProps) {
  const base: CSSProperties | undefined = className
    ? undefined
    : {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        height: 36,
        padding: iconOnly ? 0 : "0 14px",
        width: iconOnly ? 36 : undefined,
        justifyContent: "center",
        borderRadius: 999,
        border: "1px solid #e2e8f0",
        background: "#fff",
        color: "#334155",
        font: "inherit",
        fontSize: 14,
        fontWeight: 500,
        cursor: "pointer",
      };
  return (
    <button
      type="button"
      data-tour="ayuda"
      className={className}
      style={{ ...base, ...style }}
      aria-label={iconOnly ? label : undefined}
      title={title ?? "Ver el recorrido guiado de esta pantalla"}
      onClick={() => startGuidedTour(tourId)}
    >
      <HelpIcon />
      {!iconOnly && <span>{label}</span>}
    </button>
  );
}

export function HelpIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  );
}
