"use client";

import { useCallback } from "react";

function FullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExitFullscreenIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M9 4H4v5M20 9V4h-5M15 20h5v-5M4 15v5h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export interface SimulatorViewportToolbarProps {
  containerRef: React.RefObject<HTMLElement | null>;
  isFullscreen: boolean;
  onOpenHelp: () => void;
  onOpenGallery: () => void;
  photoCount: number;
  className?: string;
}

function GalleryPlayIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <rect
        x="3.5"
        y="6"
        width="17"
        height="12"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path d="M10.5 9.25v5.5l5-2.75-5-2.75z" fill="currentColor" />
    </svg>
  );
}

export default function SimulatorViewportToolbar({
  containerRef,
  isFullscreen,
  onOpenHelp,
  onOpenGallery,
  photoCount,
  className,
}: SimulatorViewportToolbarProps) {
  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;

    try {
      if (document.fullscreenElement === el) {
        await document.exitFullscreen();
      } else {
        await el.requestFullscreen();
      }
    } catch {
      /* navegador bloqueó fullscreen */
    }
  }, [containerRef]);

  return (
    <div
      className={["cod-viewport-toolbar", className].filter(Boolean).join(" ")}
      role="toolbar"
      aria-label="Controles del visor"
    >
      <button
        type="button"
        className="cod-viewport-toolbar__btn cod-viewport-toolbar__btn--fs"
        onClick={() => void toggleFullscreen()}
        aria-label={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
        title={isFullscreen ? "Salir de pantalla completa" : "Pantalla completa"}
      >
        {isFullscreen ? <ExitFullscreenIcon /> : <FullscreenIcon />}
      </button>

      <button
        type="button"
        className="cod-viewport-toolbar__btn cod-viewport-toolbar__btn--gallery"
        onClick={onOpenGallery}
        aria-label="Abrir galería de fotos tomadas"
        title="Galería de fotos"
      >
        <GalleryPlayIcon />
        {photoCount > 0 ? (
          <span className="cod-viewport-toolbar__badge" aria-hidden="true">
            {photoCount > 99 ? "99+" : photoCount}
          </span>
        ) : null}
      </button>

      <button
        type="button"
        className="cod-viewport-toolbar__btn cod-viewport-toolbar__btn--help"
        onClick={onOpenHelp}
        aria-label="Abrir ayuda de controles"
        title="Ayuda (?)"
      >
        ?
      </button>
    </div>
  );
}
