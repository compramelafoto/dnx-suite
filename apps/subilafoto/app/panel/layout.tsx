import type { ReactNode } from "react";
import { gruposDelPanel } from "@/lib/panel-navegacion";
import { Navegacion } from "./navegacion";

/**
 * El marco de todo el panel del fotógrafo.
 *
 * Las pantallas de un evento traen su propia barra, con las secciones del evento más las
 * de la cuenta. Acá va la de las pantallas sueltas —mis eventos, perfil,
 * arrepentimientos—, que no tienen evento del que colgar.
 */
export default function MarcoDelPanel({ children }: { children: ReactNode }) {
  return (
    <div className="sobre-claro min-h-[100svh]">
      <div className="mx-auto max-w-6xl px-4 pt-6 lg:px-6">
        <Navegacion grupos={gruposDelPanel()} />
      </div>
      {children}
    </div>
  );
}
