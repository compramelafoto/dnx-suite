"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { isTrackingExcludedPath } from "@/lib/website/site-settings";

/**
 * El beacon del contador de visitas por página (PR D). Sólo se monta en el armazón del sitio
 * público (`PublicSiteExtras`), nunca en el panel ni en sus vistas previas.
 *
 * Avisa una vez por dirección, cuando la página ya está en pantalla del navegador: lo que arma el
 * servidor de antemano, la CDN o una precarga no llegan acá. Si la pestaña se abrió en segundo
 * plano (o está en «prerender»), espera a que se vea. Con `sendBeacon` el aviso no frena nada y
 * sobrevive si la persona se va enseguida. No manda cookies propias ni datos de la persona: sólo
 * la dirección. Las direcciones con token (pedido, recibo, testimonio…) no se avisan.
 */
export function ContadorVisitas({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const ultima = useRef<string | null>(null);

  useEffect(() => {
    const ruta = window.location.pathname;
    if (ultima.current === ruta) return;
    if (isTrackingExcludedPath(ruta, window.location.search)) return;

    const enviar = () => {
      if (ultima.current === ruta) return;
      ultima.current = ruta;
      const url = `/api/w/${encodeURIComponent(workspaceSlug)}/visita`;
      const cuerpo = JSON.stringify({ ruta });
      try {
        if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, new Blob([cuerpo], { type: "text/plain" }))) return;
        void fetch(url, { method: "POST", body: cuerpo, keepalive: true, credentials: "omit", headers: { "Content-Type": "text/plain" } }).catch(() => {});
      } catch {
        // Contar una visita nunca puede romper la página.
      }
    };

    if (document.visibilityState === "visible") {
      enviar();
      return;
    }
    const alVerse = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", alVerse);
      enviar();
    };
    document.addEventListener("visibilitychange", alVerse);
    return () => document.removeEventListener("visibilitychange", alVerse);
  }, [pathname, workspaceSlug]);

  return null;
}
