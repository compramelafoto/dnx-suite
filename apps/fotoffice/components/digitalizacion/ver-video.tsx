// apps/fotoffice/components/digitalizacion/ver-video.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { accionAnteError, mensajeDeEstado, modoDeReproduccion } from "@/lib/digitalizacion/cliente/reproductor";

/** Lee el estado HTTP de la playlist para explicar por qué no se puede mirar. */
async function estadoDe(src: string): Promise<number | null> {
  try {
    const r = await fetch(src, { cache: "no-store", credentials: "same-origin" });
    return r.ok ? null : r.status;
  } catch {
    return null;
  }
}

/**
 * Reproductor de la versión para mirar (HLS 720p, spec 2026-10-22, E10). `src` es la ruta de la
 * app que devuelve la playlist con los segmentos firmados. hls.js se carga recién acá (no pesa en
 * la página hasta que alguien toca "Ver") y se usa siempre que haya Media Source; el HLS nativo
 * queda para los navegadores sin Media Source (ver `modoDeReproduccion`). Saltar a la
 * hora 1 sólo baja los segmentos de ese momento.
 */
export function ReproductorHls({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    let hls: Hls | null = null;
    let vivo = true;
    let reintentosRed = 0;
    let recuperacionesMedia = 0;
    const fallar = async (estado?: number | null) => {
      const e = estado === undefined ? await estadoDe(src) : estado;
      if (vivo) setError(mensajeDeEstado(e));
    };

    const iniciar = async () => {
      const { default: HlsJs } = await import("hls.js");
      if (!vivo) return;
      const modo = modoDeReproduccion(video.canPlayType("application/vnd.apple.mpegurl"), HlsJs.isSupported());
      if (modo === "NATIVO") {
        video.addEventListener("error", () => void fallar(), { once: true });
        video.src = src;
        return;
      }
      if (modo === "NINGUNO") {
        setError("Este navegador no puede reproducir el video. Probá con Chrome, Safari o Firefox actualizados.");
        return;
      }
      const crear = (desde: number) => {
        hls?.destroy();
        const h = new HlsJs({ startPosition: desde, maxBufferLength: 30, maxMaxBufferLength: 60 });
        hls = h;
        h.on(HlsJs.Events.ERROR, (_ev, data) => {
          if (!data.fatal) return;
          const codigo = data.response?.code;
          // La playlist la sirve la app: si responde que no (saldo, borrado, sin permiso), no se reintenta.
          if (data.details === HlsJs.ErrorDetails.MANIFEST_LOAD_ERROR && codigo && codigo >= 400 && codigo < 500) {
            h.destroy();
            void fallar(codigo);
            return;
          }
          const accion = accionAnteError(data.type, reintentosRed, recuperacionesMedia);
          if (accion === "RECARGAR") {
            // Las firmas de los segmentos vencen a las 4 h: pedir la playlist de nuevo trae firmas nuevas.
            reintentosRed++;
            crear(video.currentTime || desde);
          } else if (accion === "RECUPERAR_MEDIA") {
            recuperacionesMedia++;
            h.recoverMediaError();
          } else {
            h.destroy();
            void fallar(null);
          }
        });
        h.loadSource(src);
        h.attachMedia(video);
      };
      crear(-1);
    };
    void iniciar().catch(() => void fallar(null));

    return () => {
      vivo = false;
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  if (error) return <p className="rounded border p-3 text-sm">{error}</p>;
  return (
    // Videos caseros digitalizados: no tienen subtítulos.
    <video ref={videoRef} controls autoPlay playsInline preload="metadata" className="aspect-video w-full rounded bg-black" controlsList="nodownload" />
  );
}

/**
 * "Ver" de la página pública de videos: el reproductor aparece recién al tocar, así no se baja
 * nada sólo por abrir la página. Mirar usa la versión HLS 720p y no cuenta como descarga.
 */
export function VerVideo({ src }: { src: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!abierto) {
    return <button type="button" className="fo-btn fo-btn-primary text-sm" onClick={() => setAbierto(true)}>Ver</button>;
  }
  return <div className="w-full"><ReproductorHls src={src} /></div>;
}
