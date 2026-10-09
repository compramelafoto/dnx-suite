"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Vuelve a pedir los datos de la pantalla cada tanto (`router.refresh()`), sin recargar la página
 * ni perder lo que se está escribiendo. Se pausa con la pestaña oculta y, al volver, refresca de
 * inmediato.
 */
export function RefrescoPeriodico({ segundos }: { segundos: number }) {
  const router = useRouter();
  useEffect(() => {
    const cada = Math.max(2, segundos) * 1000;
    const refrescar = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const intervalo = window.setInterval(refrescar, cada);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [router, segundos]);
  return null;
}
