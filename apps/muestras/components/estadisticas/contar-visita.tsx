"use client";

import { useEffect } from "react";

/**
 * Cuenta una visita a la página (D14): una vez por pestaña, sin cookies. Las páginas públicas se
 * sirven de caché, así que el servidor no se entera de otra forma. No dibuja nada.
 */
export function ContarVisita({ actividad, obra }: { actividad: string; obra?: string }) {
  useEffect(() => {
    const clave = `mf-visita:${actividad}:${obra ?? ""}`;
    try {
      if (sessionStorage.getItem(clave)) return;
      sessionStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento (modo privado estricto): se cuenta igual.
    }
    const cuerpo = JSON.stringify(obra ? { a: actividad, o: obra } : { a: actividad });
    try {
      if (navigator.sendBeacon?.("/api/visitas", new Blob([cuerpo], { type: "application/json" }))) return;
    } catch {
      // Sigue con fetch.
    }
    void fetch("/api/visitas", { method: "POST", body: cuerpo, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }, [actividad, obra]);
  return null;
}
