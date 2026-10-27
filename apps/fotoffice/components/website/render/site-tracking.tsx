"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { isTrackingExcludedPath, type TrackingScript } from "@/lib/website/site-settings";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Google Analytics 4 y el píxel de Meta del sitio público. Sólo se monta en el armazón del sitio
 * público (`PublicSiteShell`): nunca en el panel. Los scripts los arma `buildTrackingScripts` a
 * partir de IDs validados; nada de código escrito por la persona.
 *
 * Nada se mide en una dirección con un token (pedido, recibo, testimonio personal, vuelta de un
 * pago…; ver `isTrackingExcludedPath`), para no mandarle ese enlace a Google ni a Meta:
 * - los scripts se montan recién en la primera dirección permitida (y esa vista la mandan ellos);
 * - GA4 se configura sin vista automática y cada cambio de página se avisa a mano, igual que al
 *   píxel, sólo si la dirección nueva está permitida.
 *
 * La consulta (`?t=…`) se lee de `window.location` dentro del efecto y no con `useSearchParams`:
 * éste, en un layout, obligaría a envolver el sitio en Suspense o a dibujarlo en el cliente.
 */
export function SiteTracking({ scripts }: { scripts: TrackingScript[] }) {
  const pathname = usePathname();
  const [cargar, setCargar] = useState(false);
  const vistaInicial = useRef<string | null>(null);

  useEffect(() => {
    if (isTrackingExcludedPath(pathname, window.location.search)) return;
    const url = window.location.pathname + window.location.search;
    if (!cargar) {
      vistaInicial.current = url;
      // Montar los scripts depende de la dirección del navegador, que sólo existe en el cliente.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- se lee `window.location`, que no existe en el servidor
      setCargar(true);
      return;
    }
    // La primera vista ya la mandaron los scripts al cargarse.
    if (vistaInicial.current === url) {
      vistaInicial.current = null;
      return;
    }
    vistaInicial.current = null;
    window.gtag?.("event", "page_view", { page_location: window.location.href });
    window.fbq?.("track", "PageView");
  }, [pathname, cargar]);

  if (!cargar || scripts.length === 0) return null;

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
