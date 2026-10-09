import type { ReactNode } from "react";
import { seccionesDelPanel } from "@/lib/panel-navegacion";
import { Navegacion } from "./navegacion";

/**
 * El marco de todo el panel del fotógrafo.
 *
 * Existe desde el 2026-10-09. Antes las trece pantallas estaban sueltas y cada una era
 * un callejón sin salida del que se volvía con el botón "atrás" del navegador.
 */
export default function MarcoDelPanel({ children }: { children: ReactNode }) {
  return (
    <div className="sobre-claro min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-6">
        <Navegacion secciones={seccionesDelPanel()} />
      </div>
      {children}
    </div>
  );
}
