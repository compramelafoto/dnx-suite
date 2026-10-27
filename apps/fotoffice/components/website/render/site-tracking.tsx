"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { isTrackingExcludedPath, type TrackingScript } from "@/lib/website/site-settings";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4 y el píxel de Meta del sitio público. Sólo se monta en el layout de
 * `/w/[workspaceSlug]` (también en el dominio propio): nunca en el panel. Los scripts los arma
 * `buildTrackingScripts` a partir de IDs validados; nada de código escrito por la persona.
 *
 * En las páginas con un token en la dirección (pedido, recibo, contrato…) no se carga nada, para
 * no mandarle ese enlace a Google ni a Meta.
 *
 * GA4 registra solo las navegaciones internas (medición mejorada); el píxel no, así que se le
 * avisa a mano cada cambio de página.
 */
export function SiteTracking({ scripts }: { scripts: TrackingScript[] }) {
  const pathname = usePathname();
  const primera = useRef(true);
  const hayPixel = scripts.some((s) => s.id === "fo-meta-pixel");

  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    if (hayPixel && !isTrackingExcludedPath(pathname)) window.fbq?.("track", "PageView");
  }, [pathname, hayPixel]);

  if (scripts.length === 0 || isTrackingExcludedPath(pathname)) return null;

  return (
    <>
      {scripts.map((s) =>
        s.src ? (
          <Script key={s.id} id={s.id} src={s.src} strategy="afterInteractive" />
        ) : (
          <Script key={s.id} id={s.id} strategy="afterInteractive">
            {s.inline}
          </Script>
        ),
      )}
    </>
  );
}
