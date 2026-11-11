"use client";

import { useState } from "react";

/**
 * El reproductor de Cloudflare Stream para un vivo o una grabación. Recibe la dirección ya
 * firmada (`urlDeReproduccion`): quien la arma comprobó antes que la persona puede mirar.
 *
 * Vertical (9:16) por omisión, que es el formato recomendado para transmitir.
 *
 * Se queda con la primera dirección que recibe: las pantallas del vivo se refrescan solas y cada
 * refresco firma un permiso nuevo; si el iframe tomara cada uno, el video se cortaría. Quien lo
 * usa le pone `key` = uid del video, así cambia sólo cuando cambia lo que se mira.
 */
export function ReproductorStream({
  url,
  titulo,
  vertical = true,
}: {
  url: string;
  titulo: string;
  vertical?: boolean;
}) {
  const [src] = useState(url);
  return (
    <div
      className={`relative w-full overflow-hidden rounded-[var(--fo-radius)] bg-black ${vertical ? "max-w-sm" : "max-w-3xl"}`}
      style={{ aspectRatio: vertical ? "9 / 16" : "16 / 9" }}
    >
      <iframe
        src={src}
        title={titulo}
        className="absolute inset-0 h-full w-full border-0"
        allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
      />
    </div>
  );
}
