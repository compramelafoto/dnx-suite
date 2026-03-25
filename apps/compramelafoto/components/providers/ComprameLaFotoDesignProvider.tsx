"use client";

import { useState, type ReactNode } from "react";
import { DesignSystemProvider, themeComprameLaFoto } from "@repo/design-system";
import type { ColorMode } from "@repo/design-system";

/**
 * Envuelve la app con el tema ComprameLaFoto del paquete compartido (`compositionSpacing`, tokens, marca).
 * Modo claro por defecto; `setMode` permite oscuro (p. ej. showroom o preferencias futuras).
 */
export default function ComprameLaFotoDesignProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ColorMode>("light");

  return (
    <DesignSystemProvider theme={themeComprameLaFoto.brand} mode={mode} setMode={setMode}>
      {children}
    </DesignSystemProvider>
  );
}
