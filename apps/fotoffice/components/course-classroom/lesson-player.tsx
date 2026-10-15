"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";
import { INTERVALO_REPORTE_SEGUNDOS } from "@/lib/course-classroom/progress-rules";
import { posicionDeMarca, SEGUNDOS_POR_POSICION } from "@/lib/course-classroom/watermark";

type StreamPlayer = {
  currentTime: number;
  paused: boolean;
  addEventListener: (evento: string, fn: () => void) => void;
  removeEventListener: (evento: string, fn: () => void) => void;
};

declare global {
  interface Window {
    Stream?: (iframe: HTMLIFrameElement) => StreamPlayer;
  }
}

/**
 * El video de una clase.
 *
 * - La marca de agua va **encima** del iframe, en un contenedor propio. Por eso la pantalla
 *   completa es la del contenedor (botón propio) y el iframe niega de forma explícita tanto
 *   la pantalla completa como picture-in-picture (omitirlos en `allow` no alcanza: su valor por
 *   defecto es `*`). Las dos dejarían la marca afuera.
 * - El avance cuenta sólo la reproducción normal: un salto de la barra no suma. Igual el
 *   servidor desconfía (ver `progress-rules.ts`).
 * - `reporte` en null = clase de muestra: no se informa nada.
 * - La página lo monta con `key` = id de la clase: al cambiar de clase se desmonta y se vuelve a
 *   montar, así no se arrastra el estado del video anterior.
 */
export function LessonPlayer({
  iframeUrl,
  marca,
  reporte,
}: {
  iframeUrl: string;
  marca: string | null;
  reporte: { url: string; lessonId: string; courseId: string } | null;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const iframe = useRef<HTMLIFrameElement>(null);
  const jugador = useRef<StreamPlayer | null>(null);
  const ultimoTiempo = useRef<number | null>(null);
  const ultimaPosicion = useRef(0);
  const acumulado = useRef(0);
  const [sdkListo, setSdkListo] = useState(false);
  const [paso, setPaso] = useState(0);

  useEffect(() => {
    if (!marca) return;
    const id = setInterval(() => setPaso((p) => p + 1), SEGUNDOS_POR_POSICION * 1000);
    return () => clearInterval(id);
  }, [marca]);

  const enviar = useCallback(() => {
    if (!reporte || !jugador.current) return;
    const visto = Math.floor(acumulado.current);
    if (visto <= 0) return;
    acumulado.current -= visto;
    void fetch(reporte.url, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: reporte.courseId,
        lessonId: reporte.lessonId,
        positionSeconds: Math.floor(ultimaPosicion.current),
        watchedSinceLastReport: visto,
      }),
    }).catch(() => {});
  }, [reporte]);

  useEffect(() => {
    if (!sdkListo || !iframe.current || !window.Stream) return;
    const p = window.Stream(iframe.current);
    jugador.current = p;
    ultimoTiempo.current = null;
    ultimaPosicion.current = 0;
    acumulado.current = 0;

    const alAvanzar = () => {
      const t = p.currentTime;
      ultimaPosicion.current = t;
      const previo = ultimoTiempo.current;
      ultimoTiempo.current = t;
      if (previo === null || p.paused) return;
      const delta = t - previo;
      if (delta > 0 && delta < 2) acumulado.current += delta;
    };
    const alFrenar = () => enviar();
    const alOcultar = () => {
      if (document.visibilityState === "hidden") enviar();
    };

    p.addEventListener("timeupdate", alAvanzar);
    p.addEventListener("pause", alFrenar);
    p.addEventListener("ended", alFrenar);
    document.addEventListener("visibilitychange", alOcultar);
    const intervalo = setInterval(enviar, INTERVALO_REPORTE_SEGUNDOS * 1000);

    return () => {
      clearInterval(intervalo);
      document.removeEventListener("visibilitychange", alOcultar);
      p.removeEventListener("timeupdate", alAvanzar);
      p.removeEventListener("pause", alFrenar);
      p.removeEventListener("ended", alFrenar);
      enviar();
      jugador.current = null;
    };
  }, [sdkListo, enviar]);

  const { top, left } = posicionDeMarca(paso);

  return (
    <div className="space-y-2">
      <Script
        src="https://embed.cloudflarestream.com/embed/sdk.latest.js"
        onLoad={() => setSdkListo(true)}
        onReady={() => setSdkListo(true)}
      />
      <div
        ref={contenedor}
        className="relative w-full overflow-hidden rounded-[var(--fo-radius)] bg-black"
        style={{ aspectRatio: "16 / 9" }}
      >
        <iframe
          ref={iframe}
          src={iframeUrl}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture 'none'; fullscreen 'none'"
          title="Video de la clase"
        />
        {marca ? (
          <div
            aria-hidden
            className="pointer-events-none absolute select-none whitespace-nowrap text-xs font-medium text-white/40 transition-all duration-700 md:text-sm"
            style={{ top: `${top}%`, left: `${left}%`, textShadow: "0 0 2px rgba(0,0,0,.6)" }}
          >
            {marca}
          </div>
        ) : null}
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="fo-btn fo-btn-secondary text-sm"
          onClick={() => void contenedor.current?.requestFullscreen?.()}
        >
          Pantalla completa
        </button>
      </div>
    </div>
  );
}
