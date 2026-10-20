"use client";

import { useEffect, useRef } from "react";
import { registrarPruebaAction } from "@/app/(shell)/ventas/impresion/actions";

/** Abre el cuadro de impresión al cargar y, al terminar, registra la hoja gastada (una sola vez). */
export function PruebaCliente({ salidaId, tamanoId }: { salidaId: string; tamanoId: string }) {
  const registrada = useRef(false);

  useEffect(() => {
    const despues = () => {
      if (registrada.current) return;
      registrada.current = true;
      void registrarPruebaAction(salidaId, tamanoId);
    };
    window.addEventListener("afterprint", despues);
    const t = setTimeout(() => window.print(), 300);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", despues);
    };
  }, [salidaId, tamanoId]);

  return (
    <div className="no-imprimir mx-auto max-w-xl p-4 text-sm">
      <button className="fo-btn" onClick={() => window.print()}>Imprimir de nuevo</button>
    </div>
  );
}
