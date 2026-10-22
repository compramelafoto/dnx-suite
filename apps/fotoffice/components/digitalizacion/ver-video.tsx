// apps/fotoffice/components/digitalizacion/ver-video.tsx
"use client";

import { useState } from "react";

/**
 * "Ver" de la página pública de videos: el reproductor aparece recién al tocar, así el navegador
 * no empieza a bajar el video (son varios GB) sólo por abrir la página. Mirar no cuenta como descarga.
 */
export function VerVideo({ url }: { url: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => setAbierto(true)}>Ver</button>;
  }
  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption -- videos caseros digitalizados: no tienen subtítulos
    <video controls autoPlay playsInline preload="metadata" src={url} className="w-full rounded bg-black" controlsList="nodownload" />
  );
}
