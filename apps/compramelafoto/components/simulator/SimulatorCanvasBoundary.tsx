"use client";

import type { ReactNode } from "react";
import { Component } from "react";

interface SimulatorCanvasBoundaryProps {
  children: ReactNode;
  onError?: (message: string) => void;
}

interface SimulatorCanvasBoundaryState {
  hasError: boolean;
  message: string;
}

/** Captura errores de montaje del canvas WebGL y muestra fallback. */
export default class SimulatorCanvasBoundary extends Component<
  SimulatorCanvasBoundaryProps,
  SimulatorCanvasBoundaryState
> {
  state: SimulatorCanvasBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): SimulatorCanvasBoundaryState {
    return { hasError: true, message: error.message || "Error desconocido" };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error.message);
    if (process.env.NODE_ENV === "development") {
      console.error("[Cam Of Duty] Error en canvas 3D:", error);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="cod-sim__canvas-fallback cod-sim__canvas-fallback--error" role="alert">
          <p className="cod-sim__canvas-fallback-text">No se pudo cargar la escena 3D.</p>
          <p className="cod-sim__canvas-fallback-hint">{this.state.message}</p>
          <button
            type="button"
            className="cod-btn cod-btn--secondary cod-btn--sm"
            onClick={() => this.setState({ hasError: false, message: "" })}
          >
            Reintentar
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
