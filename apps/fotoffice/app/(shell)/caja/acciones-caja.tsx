"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Plus, ShoppingCart, X } from "lucide-react";

/**
 * Lo de todos los días a un toque. Vender va al mostrador; un ingreso o un gasto suelto abre
 * el formulario, que antes estaba siempre desplegado arriba de todo el panorama.
 */
export function AccionesCaja({ ventasEncendido, children }: { ventasEncendido: boolean; children: ReactNode }) {
  const [anotando, setAnotando] = useState(false);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {ventasEncendido ? (
          <Link href="/ventas" className="fo-btn fo-btn-primary h-12 gap-2 px-6 text-base">
            <ShoppingCart className="size-5" aria-hidden />
            Vender
          </Link>
        ) : null}
        <button
          type="button"
          onClick={() => setAnotando((v) => !v)}
          aria-expanded={anotando}
          className="fo-btn fo-btn-secondary h-12 gap-2 px-5 text-base"
        >
          {anotando ? <X className="size-5" aria-hidden /> : <Plus className="size-5" aria-hidden />}
          {anotando ? "Cerrar" : "Anotar ingreso o gasto"}
        </button>
      </div>
      {anotando ? children : null}
    </div>
  );
}
