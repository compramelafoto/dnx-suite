"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { getMetaPixelId, isMetaPixelPathAllowed, metaTrack } from "@/lib/meta-pixel";

/**
 * Carga el píxel de Meta y cuenta una visita (PageView) por cada página pública.
 * En los paneles internos no se carga ni se mide.
 */
export default function MetaPixel() {
  const pixelId = getMetaPixelId();
  const pathname = usePathname();
  const lastTracked = useRef<string | null>(null);
  const allowed = isMetaPixelPathAllowed(pathname);

  useEffect(() => {
    if (!pixelId || !allowed || !pathname) return;
    // El primer PageView sale del propio script al iniciar; acá van las navegaciones siguientes.
    if (lastTracked.current === null) {
      lastTracked.current = pathname;
      return;
    }
    if (lastTracked.current === pathname) return;
    lastTracked.current = pathname;
    metaTrack("PageView");
  }, [pixelId, allowed, pathname]);

  if (!pixelId || !allowed) return null;

  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`}
    </Script>
  );
}
