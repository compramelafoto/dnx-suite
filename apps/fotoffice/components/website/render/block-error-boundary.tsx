"use client";

import { Component, type ReactNode } from "react";

/** Error boundary por bloque: si un bloque individual tira una excepción durante el render,
 * se omite ese bloque nada más — el resto de la Home sigue renderizando normalmente. Tiene
 * que ser un componente de clase: es el único mecanismo real de error boundary en React. */
export class BlockErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[BlockErrorBoundary] bloque tiró un error en render, omitido:", error);
    }
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}
