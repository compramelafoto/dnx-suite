"use client";

import SimulatorCanvasBoundary from "@/components/simulator/SimulatorCanvasBoundary";
import SimulatorHelpModal from "@/components/simulator/SimulatorHelpModal";
import SimulatorViewportToolbar from "@/components/simulator/SimulatorViewportToolbar";
import { COD_NAV_SURFACE_CLASS } from "@/components/simulator/scene/simulator-camera-constants";
import {
  engageSimulatorNavigation,
  setSimulatorNavSurface,
} from "@/lib/simulator/simulator-nav-surface";
import dynamic from "next/dynamic";
import { forwardRef, useCallback, useRef, useState } from "react";
import ViewfinderLetterbox from "@/components/simulator/viewfinder/ViewfinderLetterbox";
import FocusDofDebugOverlay from "@/components/simulator/viewfinder/FocusDofDebugOverlay";
import ExposureDebugOverlay from "@/components/simulator/viewfinder/ExposureDebugOverlay";
import SimulatorCameraHUD from "./SimulatorCameraHUD";

const SimulatorCanvas = dynamic(() => import("./scene/SimulatorCanvas"), {
  ssr: false,
  loading: () => (
    <div className="cod-sim__canvas-fallback" role="status" aria-live="polite">
      <div className="cod-sim__canvas-fallback-spinner" aria-hidden="true" />
      <p className="cod-sim__canvas-fallback-text">Cargando escena 3D…</p>
    </div>
  ),
});

export interface SimulatorViewportProps {
  isFullscreen?: boolean;
  helpOpen?: boolean;
  onOpenHelp?: () => void;
  onCloseHelp?: () => void;
  onOpenGallery?: () => void;
  photoCount?: number;
}

const SimulatorViewport = forwardRef<HTMLDivElement, SimulatorViewportProps>(
  function SimulatorViewport(
    {
      isFullscreen = false,
      helpOpen = false,
      onOpenHelp,
      onCloseHelp,
      onOpenGallery,
      photoCount = 0,
    },
    forwardedRef,
  ) {
    const viewportRef = useRef<HTMLDivElement>(null);
    const setViewportRef = useCallback(
      (node: HTMLDivElement | null) => {
        viewportRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef],
    );

    const [isNavigating, setIsNavigating] = useState(false);
    const [isSceneReady, setIsSceneReady] = useState(false);
    const [canvasError, setCanvasError] = useState<string | null>(null);

    const handleLockChange = useCallback((locked: boolean) => {
      setIsNavigating(locked);
    }, []);

    const handleLoaded = useCallback(() => {
      setIsSceneReady(true);
      setCanvasError(null);
      if (process.env.NODE_ENV === "development") {
        console.info("[Cam Of Duty] Canvas WebGL montado");
      }
    }, []);

    const handleCanvasError = useCallback((message: string) => {
      setCanvasError(message);
      setIsSceneReady(false);
    }, []);

    return (
      <div ref={setViewportRef} className="cod-sim__viewport-wrap">
        <div className="cod-sim__canvas-layer">
          <SimulatorCanvasBoundary onError={handleCanvasError}>
            <SimulatorCanvas onLockChange={handleLockChange} onLoaded={handleLoaded} />
          </SimulatorCanvasBoundary>
        </div>

        <div
          ref={setSimulatorNavSurface}
          className={COD_NAV_SURFACE_CLASS}
          role="button"
          tabIndex={0}
          aria-label="Click para activar navegación en la escena. Usá WASD para moverte y el mouse para mirar. ESC para salir."
          data-cod-nav-surface=""
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              void engageSimulatorNavigation();
            }
          }}
        />

        <ViewfinderLetterbox />

        <SimulatorCameraHUD />

        <FocusDofDebugOverlay />

        <ExposureDebugOverlay />

        {onOpenHelp && onOpenGallery ? (
          <SimulatorViewportToolbar
            containerRef={viewportRef}
            isFullscreen={isFullscreen}
            onOpenHelp={onOpenHelp}
            onOpenGallery={onOpenGallery}
            photoCount={photoCount}
            className="cod-viewport-toolbar--visor-tr"
          />
        ) : null}

        {onCloseHelp ? (
          <SimulatorHelpModal open={helpOpen} onClose={onCloseHelp} />
        ) : null}

        {canvasError && (
          <div className="cod-sim__canvas-error-banner" role="alert">
            Escena 3D: {canvasError}
          </div>
        )}

        {isSceneReady && isNavigating && (
          <div
            className="cod-sim__nav-banner cod-sim__nav-banner--active"
            role="status"
            aria-live="polite"
          >
            Navegación activa — ESC para salir
          </div>
        )}
      </div>
    );
  },
);

export default SimulatorViewport;
